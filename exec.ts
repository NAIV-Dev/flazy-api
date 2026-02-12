#!/usr/bin/env node
import { cmdRun } from "./command/cmd-run";
import { cmdChat } from "./command/cmd-chat";
import axios, { AxiosResponse } from 'axios';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { DBCredential } from "./server";

const argv = yargs(hideBin(process.argv))
  .option("run", {
    type: "string",
    requiresArg: false,
    coerce: val => val === "" ? '.' : val
  })
  .option("port", {
    type: "number",
    requiresArg: false,
  })
  .option("dburl", {
    type: "string",
    requiresArg: false,
  })
  .option("dbkey", {
    type: "string",
    requiresArg: false
  })
  .option("chat", {
    type: "boolean",
    requiresArg: false
  })
  .option("model", {
    type: "string",
    requiresArg: false
  })
  .parse() as { chat?: boolean, run?: string, dbkey?: string, port?: number, dburl?: string, model?: string };

const dir_path = argv.run;
const port = argv.port;
const dburl = argv.dburl;
const database_key = argv.dbkey;
const chat_mode = argv.chat;
const llm_model = argv.model;

if ((dir_path && chat_mode) || (!dir_path && !chat_mode)) {
  console.error([
    'Wrong usage!',
    'You must choose one mode --run or --chat',
    'get dbkey uniqid from naiv.dev/zero for free',
    '',
    'Example:',
    '# starts naiv specification mode',
    'flazy-api --chat',
    '',
    '# run current working directory',
    'flazy-api --run --dbkey 976dc5...',
    '',
    '# run myfolder directory',
    'flazy-api --run myfolder --dbkey 976dc5...',
    '',
  ].join('\n'));
  process.exit(1);
}

if (dir_path) {
  if (!database_key) {
    console.error([
      'Wrong usage!',
      'flazy-api --run must have --dbkey argument',
      'get dbkey uniqid from naiv.dev/zero for free',
      '',
      'Example:',
      '# run current working directory',
      'flazy-api --run --dbkey 976dc5...',
      '',
      '# run myfolder directory',
      'flazy-api --run myfolder --dbkey 976dc5...',
      '',
    ].join('\n'));
    process.exit(1);
  }
  axios.get(dburl ?? 'https://api-x.naiv.dev/db-credential', { headers: { uniqid: database_key } })
  .then((res: AxiosResponse<DBCredential>) => {
    console.log(`DB Key Accepted!`);
    cmdRun(port ?? 9000, dir_path, res.data, llm_model).then(() => console.log('completed.')).catch(e => console.error(e?.message));
  })
  .catch((err: any) => {
    console.error(err?.response?.data?.toString());
  });
} else if (chat_mode) {
  cmdChat(llm_model).catch(console.error);
}
