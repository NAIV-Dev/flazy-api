import { NVAPI } from "@naiv/core/build/semantic-checker/check_api";
import { ItemOutput } from "./data-types";
import { buildField, BuildFieldResult, buildInlineSchemaClass, getSchemaContent, SchemaContentResult } from "./build-from-schema";
import { NVSchema } from "@naiv/core/build/semantic-checker/check_schema";
import { NVSchemaItem } from "@naiv/core/build/semantic-checker/check_schema_item";
import _ from "lodash";

export function getAPIFileName(api_alias: string, api: NVAPI, extension?: string): string {
  const is_streaming = api.data.return_type.kind === 'stream';
  return `./api/${is_streaming ? 'S_' : 'T_'}${api_alias}${extension ?? ''}`;
}

export function buildFromAPI(api: NVAPI, list_schema: NVSchema[]): ItemOutput {
  const is_streaming = api.data.return_type.kind === 'stream';
  const prefix = is_streaming ? 'S_' : 'T_';
  if (!api.data.alias) {
    throw new Error(`no api alias`);
  }
  
  let header_schema: SchemaContentResult | undefined;
  if ((api.data.headers?.length ?? 0) > 0) {
    const s: NVSchema = {
      name: `${prefix}${api.data.alias}_headers`,
      items: api.data.headers ?? []
    };
    header_schema = getSchemaContent(s, list_schema);
  }
  let query_schema: SchemaContentResult | undefined;
  if ((api.data.query?.length ?? 0) > 0) {
    const s: NVSchema = {
      name: `${prefix}${api.data.alias}_query`,
      items: api.data.query ?? []
    };
    query_schema = getSchemaContent(s, list_schema);
  }
  let path_schema: SchemaContentResult | undefined;
  if ((api.data.path?.length ?? 0) > 0) {
    const s: NVSchema = {
      name: `${prefix}${api.data.alias}_path`,
      items: api.data.path ?? []
    };
    path_schema = getSchemaContent(s, list_schema);
  }
  let body_schema: SchemaContentResult | undefined;
  if ((api.data.body?.length ?? 0) > 0) {
    const s: NVSchema = {
      name: `${prefix}${api.data.alias}_body`,
      items: api.data.body ?? []
    };
    body_schema = getSchemaContent(s, list_schema);
  }

  const fake_return_type_schema: NVSchema = {
    name: 'ReturnType',
    items: [{
      key: 'rrr',
      type: api.data.return_type.type
    }]
  };
  const fake_return_type_schema_result: SchemaContentResult = getSchemaContent(fake_return_type_schema, list_schema);

  const fake_return_type: NVSchemaItem = {
    key: 'rrr',
    type: api.data.return_type.type
  };
  const fake_return_type_field_result: BuildFieldResult = buildField(fake_return_type, 0, { name: 'ReturnType', items: [] }, list_schema);

  return {
    files: [{
      filename: getAPIFileName(api.data.alias, api, '.ts'),
      content: [
'import { Response } from "express";',
`${
  _.uniq([
    ...(header_schema?.deps ?? []),
    ...(query_schema?.deps ?? []),
    ...(path_schema?.deps ?? []),
    ...(body_schema?.deps ?? []),
    ...(fake_return_type_schema_result.deps ?? []),
    ...(fake_return_type_field_result.new_deps_lines ?? []),
    
  ].join('\n').split('\n')).join('\n')
}

${
  [
    ...(header_schema?.content ?? []),
    ...(query_schema?.content ?? []),
    ...(path_schema?.content ?? []),
    ...(body_schema?.content ?? []),
    ...fake_return_type_field_result.new_class_lines,
  ].join('\n')
}

export type ${prefix}${api.data.alias} = (request: {
${
  [
    (header_schema?.content.length ?? 0) > 0 ? `  headers: ${prefix}${api.data.alias}_headers` : '',
    (query_schema?.content.length ?? 0) > 0 ? `  query: ${prefix}${api.data.alias}_query` : '',
    (path_schema?.content.length ?? 0) > 0 ? `  path: ${prefix}${api.data.alias}_path` : '',
    (body_schema?.content.length ?? 0) > 0 ? `  body: ${prefix}${api.data.alias}_body` : '',
  ].filter(Boolean).join('\n')
}
${
  is_streaming
  ? `}, stream: (chunk: ${fake_return_type_field_result.type_only}${api.data.return_type.type.required ? '' : ' | null'}) => void, response: Response) => Promise<void>;`
  : `}, response: Response) => Promise<${fake_return_type_field_result.type_only}${api.data.return_type.type.required ? '' : ' | null'}>;`
}

export const method = '${api.method.toLowerCase()}';
export const url_path = '${api.url_path}';
export const alias = '${prefix}${api.data.alias}';
export const is_streaming = ${is_streaming ? 'true' : 'false'};
`
      ].join('\n')
    }],
    map: {
      [api.data.alias]: getAPIFileName(api.data.alias, api)
    }
  }
}
