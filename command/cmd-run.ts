import { generateAPICodeFiles } from "../code-generator/generate-code";
import { compileAndClean } from "../compile-folder";
import { DBCredential, XServer } from "../server";
import path from 'path';
import fs from 'fs';
import { globSync } from "glob";

export async function cmdRun(port: number, naiv_cwd: string, db_credential: DBCredential, llm_model?: string) {
  const list_naiv_file = globSync("*.naiv", {
    cwd: naiv_cwd,
    absolute: true,
    ignore: ["**/node_modules/**"]
  });

  if (list_naiv_file.length == 0) {
    throw new Error(`No NAIV files is found. Create new data and API design with "flazy-api --chat"`);
  }

  const working_directory = path.resolve(naiv_cwd, './__flazy');
  if (!fs.existsSync(working_directory)) {
    await fs.promises.mkdir(working_directory);
  }

  const program_nm_root = path.resolve(__dirname, '../../node_modules');
  const working_directory_nm_symlink = path.resolve(naiv_cwd, './__flazy/node_modules');
  if (fs.existsSync(working_directory_nm_symlink)) {
    await fs.promises.rm(working_directory_nm_symlink);
  }
  await fs.promises.symlink(program_nm_root, working_directory_nm_symlink);

  const types_path = path.resolve(naiv_cwd, './__flazy/__types__');

  await fs.promises.rm(types_path, { force: true, recursive: true });
  let blueprint: string[] = [];
  for (const naiv_file of list_naiv_file) {
    blueprint.push(await fs.promises.readFile(naiv_file, 'utf-8'));
  }
  const nv_result = await generateAPICodeFiles(naiv_cwd, types_path);
  await compileAndClean({
    source_abs_folder_path: types_path
  });

  const source_implementation_path = path.resolve(naiv_cwd, './__flazy/original-implementation');
  const transp_implementation_path = path.resolve(naiv_cwd, './__flazy/__implementation__');
  if (fs.existsSync(source_implementation_path)) {
    await fs.promises.rm(transp_implementation_path, { force: true, recursive: true });
    await compileAndClean({
      source_abs_folder_path: source_implementation_path,
      target_abs_folder_path: transp_implementation_path,
    });
  } else {
    await fs.promises.mkdir(source_implementation_path);
  }

  await (new XServer({ naivCwd: naiv_cwd, db_credential, port, llm_model })).run({
    port,
    types_path,
    implementation_path: transp_implementation_path,
    nv_result,
    blueprint
  });
}
