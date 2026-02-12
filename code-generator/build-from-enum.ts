import { NVEnum } from "@naiv/core";
import { ItemOutput } from "./data-types";

export function getEnumFileName(item: NVEnum, extension?: string): string {
  return `./model/enum/${item.name}${extension ?? ''}`;
}

export function buildFromEnum(enume: NVEnum): ItemOutput {
  return {
    files: [{
      filename: getEnumFileName(enume, '.ts'),
      content: [
        `export enum ${enume.name} {`,
        ...enume.items
          .map(s => `'${s}' = '${s}',`)
          .map(line => '  ' + line),
        `};`
      ].join('\n')
    }],
    map: {
      [enume.name]: getEnumFileName(enume)
    }
  };
}
