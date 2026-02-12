import { NVEnum, NVResult, NVTable, NVTableField, NVTableFieldType } from "@naiv/core";
import { CodegenFileOutput, ItemOutput, MapModelNameFilePath } from "./data-types";
import { buildFromTable } from "./build-from-table";
import { buildFromEnum } from "./build-from-enum";
import { buildFromSchema } from "./build-from-schema";
import { NVSchema } from "@naiv/core/build/semantic-checker/check_schema";
import { buildFromAPI } from "./build-from-api";
import { NVAPI } from "@naiv/core/build/semantic-checker/check_api";
import { XServer } from '../server';

export namespace APIModel {
  export interface Output {
    table: ItemOutput
    enum: ItemOutput
    schema: ItemOutput
    api: ItemOutput
  }

  export function compile(source: NVResult): Output {
    const list_api_output: ItemOutput[] = source.list_api.map((t: NVAPI) => buildFromAPI(t, source.list_schema));
    const list_schema_output: ItemOutput[] = source.list_schema.map((t: NVSchema) => buildFromSchema(t, source.list_schema));
    const list_table_output: ItemOutput[] = source.list_table.map((t: NVTable) => buildFromTable(t, source));
    const list_enume_output: ItemOutput[] = source.list_enum.map((t: NVEnum) => buildFromEnum(t));
    
    return {
      api: {
        files: list_api_output.reduce((accumulator: CodegenFileOutput[], o: ItemOutput) => [...accumulator, ...o.files], []),
        map: list_api_output.reduce((accumulator: MapModelNameFilePath, o: ItemOutput) => ({ ...accumulator, ...o.map }), {})
      },
      schema: {
        files: list_schema_output.reduce((accumulator: CodegenFileOutput[], o: ItemOutput) => [...accumulator, ...o.files], []),
        map: list_schema_output.reduce((accumulator: MapModelNameFilePath, o: ItemOutput) => ({ ...accumulator, ...o.map }), {})
      },
      table: {
        files: list_table_output.reduce((accumulator: CodegenFileOutput[], o: ItemOutput) => [...accumulator, ...o.files], []),
        map: list_table_output.reduce((accumulator: MapModelNameFilePath, o: ItemOutput) => ({ ...accumulator, ...o.map }), {})
      },
      enum: {
        files: list_enume_output.reduce((accumulator: CodegenFileOutput[], o: ItemOutput) => [...accumulator, ...o.files], []),
        map: list_enume_output.reduce((accumulator: MapModelNameFilePath, o: ItemOutput) => ({ ...accumulator, ...o.map }), {})
      }
    };
  }
}

export { XServer };
