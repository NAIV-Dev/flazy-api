import 'reflect-metadata';
import { DataSource, DataSourceOptions } from "typeorm";
import express, { Express, Request, Response, Router } from 'express';
import cors from 'cors';
import { plainToInstance } from "class-transformer";
import { ValidationError, validateOrReject } from "class-validator"
import path from 'path';
import fsPromises from 'fs/promises';
import { Server, IncomingMessage, ServerResponse } from 'http';
import { cmdRun } from './command/cmd-run';
import { compileSingleFile } from './compile-folder';
import { ImplPromptParam } from './prompt';
import fs from 'fs';
import { NVResult } from '@naiv/core';
import { globSync } from 'glob';
import { generateFirstImplementationPlan } from './agent-mode/plan-preparation';
import { executePlanAndGetNextPlan } from './agent-mode/plan-execution-and-next';
import { createRequire } from 'module';

const projectRequire = createRequire(
  path.resolve(__dirname, '../package.json')
);

type SupportedMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface SystemParam {
  api_prefix?: string
  port: number
  types_path: string
  implementation_path: string
  beforeStart?(): Promise<void>
  nv_result: NVResult
  blueprint: string[]
  llm_model?: string
}

export interface DBCredential {
  db_type: string
  db_host: string
  db_name: string
  db_username: string
  db_password: string
  db_port: number
}

export interface ServerConstructorParam {
  noCors?: boolean
  noTrustProxy?: boolean
  naivCwd: string
  db_credential: DBCredential
  port: number
  llm_model?: string
}

export class XServer {
  public express: Express = express();
  private server_instance: Server<typeof IncomingMessage, typeof ServerResponse> | undefined;
  private constructor_param: ServerConstructorParam | undefined;
  private server_param: SystemParam | undefined;
  private AppDataSource: DataSource | undefined;

  constructor(param?: ServerConstructorParam) {
    this.constructor_param = param;
  }

  private restart() {
    console.log("Shutting down...");
    this.server_instance?.close(async () => {
      await this.AppDataSource?.destroy();
      console.log("HTTP server closed");
      if (this.server_param) {
        console.log("Restarting server...");
        cmdRun(
          this.constructor_param!.port,
          this.constructor_param!.naivCwd,
          this.constructor_param!.db_credential,
          this.constructor_param!.llm_model
        );
      }
    });
  }

  public async run(param: SystemParam): Promise<XServer> {
    try {
      const types_location = path.resolve(this.constructor_param!.naivCwd, './__flazy/__types__/model/**/*.js');
      this.AppDataSource = new DataSource({
        type: this.constructor_param!.db_credential.db_type as any,
        host: this.constructor_param!.db_credential.db_host,
        port: this.constructor_param!.db_credential.db_port,
        username: this.constructor_param!.db_credential.db_username,
        password: this.constructor_param!.db_credential.db_password,
        database: this.constructor_param!.db_credential.db_name,
        synchronize: true,
        logging: false,
        // migrations: [
        //   param?.naivCwd + '/migration/**.ts'
        // ],
        entities: [
          types_location
        ]
      } satisfies DataSourceOptions);
      const prefix_model = path.resolve(this.constructor_param!.naivCwd, './__flazy/__types__/model');
      Object.keys(projectRequire.cache).forEach((k) => {
        if (k.startsWith(prefix_model)) {
          delete projectRequire.cache[k];
        }
      });
      await this.AppDataSource?.initialize();
      console.log(`db initialized`);
    } catch (err: any) {
      console.log(`Error initializing database: ${err?.toString()}`);
    }
    this.server_param = param;
    if (!this.constructor_param?.noCors) {
      this.express.use(cors());
    }
    this.express.use(express.json({ limit: '5mb' }));
    if (!this.constructor_param?.noTrustProxy) {
      this.express.set('trust proxy', true);
    }
    if (param.beforeStart) {
      await param.beforeStart();
    }

    await this._run(param.types_path, param.implementation_path, param.api_prefix);
    const port = param?.port ?? process.env.PORT ?? 3000;
    this.express.post('/__restart__', (req, res) => {
      this.restart();
      res.status(200).send('restarting...');
    });
    this.server_instance = this.express.listen(port, () => {
      console.log(`\n⚡️[server]: Server is running at http://localhost:${port}`);
    });

    return this;
  }

  private errorToString(list_error: ValidationError[]): string {
    return list_error.map(err => {
      const children: ValidationError[] | undefined = err.children;
      if (children && children.length > 0) {
        return this.errorToString(children);
      }
      const constrains: any = err.constraints;
      const keys = Object.keys(constrains);
      return keys.filter(key => constrains[key].length > 0).map(key => constrains[key]).join(', ');
    }).join(', ');
  }

  private async getImplementationFunction(file: string, types_folder_abs_path: string, implementation_folder: string): Promise<{
    fn: Function | null
    types: any
    method: string
    alias: string
    url_path: string
    is_streaming: boolean
  }> {
    const filename_without_ext = path.basename(file, path.extname(file));
    const path_location = path.join(types_folder_abs_path, 'api', filename_without_ext);
    delete projectRequire.cache[`${implementation_folder}/${file}`];
    const types = await import(path_location);
    const method = types['method'];
    const url_path = types['url_path'];
    const alias = types['alias'];
    const is_streaming = types['is_streaming'];
    if (!alias) {
      console.warn(`⚠️ api '${method} ${url_path}' doesnt have alias name, skip.`);
      return {
        fn: null,
        types,
        method,
        url_path,
        is_streaming,
        alias
      };
    }

    let f: any;
    try {
      f = await import(path.join(implementation_folder, alias));
      console.log(`✅ implementation for api '${method} ${url_path}' ready.`);
    } catch (err: any) {
      if (err.code === "MODULE_NOT_FOUND") {
        console.warn(`⚠️ implementation for api '${method} ${url_path}' not found, skip.`);
        return {
          fn: null,
          types,
          method,
          url_path,
          is_streaming,
          alias
        };
      }
      throw err;
    }

    const export_alias = alias.charAt(0).toLowerCase() + alias.slice(1);
    const fn = f[export_alias];
    if (!fn) {
      console.warn(`⚠️ export function implementation for api '${method} ${url_path}' not found, skip.`);
      return {
        fn: null,
        types,
        method,
        url_path,
        is_streaming,
        alias
      };
    }

    return {
      fn,
      types,
      method,
      url_path,
      is_streaming,
      alias
    };
  }

  private async generateImplementationFile(file: string, description: string) {
    const prefix_source_path = path.resolve(this.constructor_param!.naivCwd, './__flazy/original-implementation');
    const prefix_target_path = path.resolve(this.constructor_param!.naivCwd, './__flazy/__implementation__');
    const types_abs_path = path.resolve(this.constructor_param!.naivCwd, './__flazy/__types__/model');
    const filename_ts = `${file.slice(0, -3)}.ts`;
    const source_abs_file_path = `${prefix_source_path}/${filename_ts}`;
    try {
      await compileSingleFile({
        source_root_folder_abs_path: prefix_source_path,
        source_abs_file_path,
        target_root_folder_abs_path: prefix_target_path
      });
    } catch {
      const types_path_abs = path.resolve(this.constructor_param!.naivCwd, `./__flazy/__types__/api/${filename_ts}`);
      const cwd = path.resolve(this.constructor_param!.naivCwd) + '/';
      const impl_param: ImplPromptParam = {
        function_name: file.slice(0, -3),
        types_relative_path: `__flazy/__types__/api/${filename_ts}`,
        target_implementation_path: `__flazy/original-implementation/api/${filename_ts}`,
        types_content: await fs.promises.readFile(types_path_abs, 'utf-8'),
        description,
        model_files_list: globSync("**/*.ts", {
          cwd: types_abs_path,
          absolute: true,
          ignore: ["**/node_modules/**"]
        }).map(x => x.replace(cwd, '')),
        blueprint: this.server_param?.blueprint.join('\n') ?? ''
      };
      let impl_plan = await generateFirstImplementationPlan(impl_param, this.constructor_param!.llm_model);
      while (impl_plan.instruction.instruction != 'finished') {
        impl_plan = await executePlanAndGetNextPlan(impl_plan, cwd, source_abs_file_path);
      }
      await compileSingleFile({
        source_root_folder_abs_path: prefix_source_path,
        source_abs_file_path,
        target_root_folder_abs_path: prefix_target_path
      });
    }
  } 

  public async _run(types_folder_abs_path: string, implementation_folder: string, api_prefix: string = '/') {
    if (!this.express) {
      throw new Error('🚨 ExpressJS has not been initialized yet');
    }

    const router = Router();
    const files = await fsPromises.readdir(path.join(types_folder_abs_path, 'api'));
    for (const file of files.filter(f => f.endsWith('.js'))) {
      const { types, method, alias, url_path, is_streaming } = await this.getImplementationFunction(file, types_folder_abs_path, implementation_folder);
      const nv_api = this.server_param?.nv_result.list_api.find(api => api.url_path == url_path);
      const description = nv_api?.data.descriptions.join('\n') || '';
      router[method.toLowerCase() as SupportedMethod](url_path, async (req: Request, res: Response) => {
        const t_headers = types[`${alias}_headers`];
        const t_query = types[`${alias}_query`];
        const t_path = types[`${alias}_path`];
        const t_body = types[`${alias}_body`];

        try {
          if (t_headers) {
            await validateOrReject(plainToInstance(t_headers, req.headers || {}));
          }
          if (t_query) {
            await validateOrReject(plainToInstance(t_query, req.query || {}));
          }
          if (t_path) {
            await validateOrReject(plainToInstance(t_path, req.params || {}));
          }
          if (t_body) {
            await validateOrReject(plainToInstance(t_body, req.body || {}));
          }
        } catch (err_validation: any) {
          res.status(400).send(this.errorToString(err_validation));
          return;
        }

        try {
          const request_params = {
            headers: req.headers,
            query: req.query,
            path: req.params,
            body: req.body,
          };
          const prefix_source_path = path.resolve(this.constructor_param!.naivCwd, './__flazy/original-implementation');
          const filename_ts = `${file.slice(0, -3)}.ts`;
          const source_abs_file_path = `${prefix_source_path}/${filename_ts}`;
          if (!fs.existsSync(source_abs_file_path)) {
            await this.generateImplementationFile(file, description);
          }
          const { fn } = await this.getImplementationFunction(file, types_folder_abs_path, implementation_folder);
          if (!fn) {
            throw new Error(`This function is not implemented yet!!`);
          }
          if (is_streaming) {
            res.status(200);
            await fn(request_params, (chunk: any) => res.write(chunk), res);
            res.end(null);
          } else {
            const result = await fn(request_params, res);
            res.status(200).json(result);
          }
        } catch (err: any) {
          // TODO: add LLM self-fixing code capability
          console.log('Error response', err);
          const err_msg = err.toString();
          if (/^s*d{3}s*:/.test(err_msg)) {
            const [err_code, msg] = err_msg.split(':');
            res.status(+err_code.trim()).send(msg);
            return;
          }
          res.status(500).send(err_msg);
        }
      });
    }

    this.express!.use(api_prefix, router);
  }
}
