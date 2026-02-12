import { NVResult } from "@naiv/core";
import { naiv_parse_folder, naiv_parser } from "@naiv/core/build/naiv_parser";
import fs from 'fs';
import path from 'path'
import { APIModel } from "./api-model";
import { CodegenFileOutput } from "./data-types";

export async function generateAPICodeFiles(design_file_abs_path: string, out_folder: string): Promise<NVResult> {
  const result: NVResult = naiv_parse_folder(design_file_abs_path, { fs, path });
  const typeorm_model = APIModel.compile(result);

  for (const f of typeorm_model.enum.files) {
    writeFiles(f, out_folder);
  }
  for (const f of typeorm_model.table.files) {
    writeFiles(f, out_folder);
  }
  for (const f of typeorm_model.schema.files) {
    writeFiles(f, out_folder);
  }
  for (const f of typeorm_model.api.files) {
    writeFiles(f, out_folder);
  }

  return result;
}

async function writeFiles(output: CodegenFileOutput, main_project_location: string = 'project') {
  const folder = main_project_location + '/' + output.filename.split('/').slice(0, -1).join('/');
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  const filename = main_project_location + '/' + output.filename;
  fs.writeFileSync(filename, output.content);
}
