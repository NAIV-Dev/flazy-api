import { NVSchema } from "@naiv/core/build/semantic-checker/check_schema";
import { ItemOutput } from "./data-types";
import _ from "lodash";
import { NVSchemaItem } from "@naiv/core/build/semantic-checker/check_schema_item";

export function getSchemaFileName(schema: NVSchema, extension?: string): string {
  return `./schema/${schema.name}${extension ?? ''}`;
}

export function buildSchemaDependency(schema: NVSchema, list_schema: NVSchema[]): string[] {
  return schema.items
    .filter((item: NVSchemaItem) => item.type.type === 'schema' || item.type.type === 'table' || item.type.type === 'enum')
    .map((item: NVSchemaItem) => {
      switch (item.type.type) {
        case 'schema': 
          const schema_item = list_schema.find((s: NVSchema) => item.type.type === 'schema' && s.name === item.type.subtype_native);
          if (!schema_item) {
            throw new Error(`Schema "${item.type.subtype_native}" is not available`);
          }
          return `import { ${schema_item.name} } from '.${getSchemaFileName(schema_item)}'`;
        case 'table':
          return `import { ${item.type.subtype_native} } from '../model/table/${item.type.subtype_native}'`;
        case 'enum':
          return `import { ${item.type.subtype_native} } from '../model/enum/${item.type.subtype_native}'`;
        default:
          return '';
      }
    });
}

export function buildFromSchema(schema: NVSchema, list_schema: NVSchema[]): ItemOutput {
  const { deps, content } = getSchemaContent(schema, list_schema);

  return {
    files: [{
      filename: getSchemaFileName(schema, '.ts'),
      content: [
        ...deps,
        '',
        ...content,
      ].join('\n')
    }],
    map: {
      [schema.name]: getSchemaFileName(schema)
    }
  }
}

export interface SchemaContentResult {
  deps: string[]
  content: string[]
}

export function getSchemaContent(schema: NVSchema, list_schema: NVSchema[], no_export?: boolean): SchemaContentResult {
  const field_lines: string[] = [];
  const new_class_lines: string[] = [];
  const new_deps_lines: string[] = [];

  let i = 0;
  for (const c of schema.items) {
    const field_result = buildField(c, i, schema, list_schema);
    field_lines.push(...field_result.field_lines);
    new_class_lines.push(...field_result.new_class_lines);
    new_deps_lines.push(...field_result.new_deps_lines);
    i++;
  }
  
  const complete_deps = _.uniq([
    `import { ClassConstructor, Transform, Type, plainToInstance } from "class-transformer";`,
    `import { IsNotEmpty, IsNumber, IsObject, IsBoolean, IsOptional, IsISO8601, IsString, IsEnum, ValidateNested, IsArray, ValidationError, validateOrReject } from "class-validator";`,
    ...buildSchemaDependency(schema, list_schema),
    ...new_deps_lines
  ].join('\n').split('\n'));

  return {
    deps: complete_deps,
    content: [
      ...new_class_lines,
      `${no_export ? '' : 'export '}class ${schema.name} {`,
      ...field_lines.map(line => '  ' + line),
      `}`
    ]
  };
}

const transform_integer = `(param?: any): number | null => (param?.value === null || param?.value === undefined || param?.value === '') ? null : parseInt(param.value)`;
const transform_arrayinteger = `(param?: any): (number | null)[] | null => !Array.isArray(param?.value) ? null : param?.value.map((value: any) => (value === null || value === undefined || value === '') ? null : parseInt(value))`;

const transform_decimal = `(param?: any): number | null => (param?.value === null || param?.value === undefined || param?.value === '') ? null : parseFloat(param.value)`;
const transform_arraydecimal = `(param?: any): (number | null)[] | null => !Array.isArray(param?.value) ? null : param?.value.map((value: any) => (value === null || value === undefined || value === '') ? null : parseFloat(value))`;

const transform_boolean = `(param?: any): boolean | null => (param?.value === null || param?.value === undefined || param?.value === '') ? null : (param?.value === 'true' || ((typeof param?.value === 'boolean') && param?.value))`;
const transform_arrayboolean = `(param?: any): (boolean | null)[] | null => !Array.isArray(param?.value) ? null : param?.value.map((value: any) => (value === null || value === undefined || value === '') ? null : (value === 'true' || ((typeof value === 'boolean') && value)))`;

const transform_date = `(param?: any): Date | null => (param?.value === null || param?.value === undefined || param?.value === '') ? null : new Date(param?.value)`;
const transform_arraydate = `(param?: any): (Date | null)[] | null => !Array.isArray(param?.value) ? null : param?.value.map((value: any) => (value === null || value === undefined || value === '') ? null : new Date(value))`;

export function getDecorators(item: NVSchemaItem): string[] {
  const list_decorator: string[] = [];
  
  if (item.type.required) {
    list_decorator.push(`@IsNotEmpty({ message: '${item.key} cannot be empty' })`);
  } else {
    list_decorator.push(`@IsOptional()`);
  }

  const is_array = item.type.array_dimension > 0;

  if (item.type.type === 'native') {
    const array_property = is_array ? ', each: true' : '';
    switch (item.type.type_native) {
      case 'number':
        list_decorator.push(`@Transform(${is_array ? transform_arraydecimal : transform_decimal})`);
        list_decorator.push(`@IsNumber({}, { message: '${item.key} must be a number (decimal)'${array_property} })`);
        break;
      case 'boolean':
        list_decorator.push(`@Transform(${is_array ? transform_arrayboolean : transform_boolean})`);
        list_decorator.push(`@IsBoolean({ message: '${item.key} must be a boolean'${array_property} })`);
        break;
      case 'string':
        list_decorator.push(`@IsString({ message: '${item.key} must be a string'${array_property} })`);
        break;
    }
  }

  if (item.type.type === 'enum') {
    const array_property = is_array ? ', each: true' : '';
    list_decorator.push(`@IsEnum(${item.type.subtype_native}, { message: '${item.key} must be enum ${item.type.subtype_native}'${array_property} })`);
  }

  if (item.type.type === 'schema') {
    if (is_array) {
      list_decorator.push(`@IsArray()`);
      list_decorator.push(`@ValidateNested({ each: true })`);
    } else {
      list_decorator.push(`@IsObject()`);
      list_decorator.push(`@ValidateNested()`);
    }
    list_decorator.push(`@Type(() => ${item.type.subtype_native})`);
  }

  if (item.type.type === 'table') {
    if (is_array) {
      list_decorator.push(`@IsArray()`);
      list_decorator.push(`@ValidateNested({ each: true })`);
    } else {
      list_decorator.push(`@IsObject()`);
      list_decorator.push(`@ValidateNested()`);
    }
    list_decorator.push(`@Type(() => ${item.type.subtype_native})`);
  }

  return list_decorator;
}

export interface BuildFieldResult {
  field_lines: string[]
  type_only: string
  new_class_lines: string[]
  new_deps_lines: string[]
}

export function buildField(item: NVSchemaItem, index: number, schema: NVSchema, list_schema: NVSchema[]): BuildFieldResult {
  const is_array = item.type.array_dimension > 0;
  const array_token = Array(item.type.array_dimension).fill('[]').join('');
  switch (item.type.type) {
    case "native":
      return {
        field_lines: [
          ...getDecorators(item),
          `${item.key}${item.type.required ? '!' : '?'}: ${item.type.type_native}${is_array ? array_token : ''}`
        ],
        type_only: `${item.type.type_native}${is_array ? array_token : ''}`,
        new_class_lines: [],
        new_deps_lines: []
      };
    case "schema":
      return {
        field_lines: [
          ...getDecorators(item),
          `${item.key}${item.type.required ? '!' : '?'}: ${item.type.subtype_native}${is_array ? array_token : ''}`
        ],
        type_only: `${item.type.subtype_native}${is_array ? array_token : ''}`,
        new_class_lines: [],
        new_deps_lines: []
      };
    case "table":
      return {
        field_lines: [
          ...getDecorators(item),
          `${item.key}${item.type.required ? '!' : '?'}: ${item.type.subtype_native}${is_array ? array_token : ''}`
        ],
        type_only: `${item.type.subtype_native}${is_array ? array_token : ''}`,
        new_class_lines: [],
        new_deps_lines: []
      };
    case "enum":
      return {
        field_lines: [
          ...getDecorators(item),
          `${item.key}${item.type.required ? '!' : '?'}: ${item.type.subtype_native}${is_array ? array_token : ''}`
        ],
        type_only: `${item.type.subtype_native}${is_array ? array_token : ''}`,
        new_class_lines: [],
        new_deps_lines: []
      };
    case "inline-schema":
      const { new_class_deps, new_class_content, inline_schema_name } = buildInlineSchemaClass((item.type.type_inline_schema ?? []), schema.name, index, list_schema);
      return {
        field_lines: [
          ...getDecorators({
            ...item,
            type: {
              ...item.type,
              subtype_native: inline_schema_name,
              type: 'schema'
            },
          }),
          `${item.key}${item.type.required ? '!' : '?'}: ${inline_schema_name}${is_array ? array_token : ''}`
        ],
        type_only: `${inline_schema_name}${is_array ? array_token : ''}`,
        new_class_lines: new_class_content,
        new_deps_lines: new_class_deps
      };
  }
}

export function buildInlineSchemaClass(items: NVSchemaItem[], parent_schema_name: string, index: number, list_schema: NVSchema[]) {
  const inline_schema: NVSchema = {
    name: [parent_schema_name, index].join('_'),
    items
  };
  const new_class = getSchemaContent(inline_schema, list_schema, true);

  return { new_class_deps: new_class.deps, new_class_content: new_class.content, inline_schema_name: inline_schema.name };
}
