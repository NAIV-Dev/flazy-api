import { NVEnum, NVResult, NVTable, NVTableField, NVTableFieldType } from "@naiv/core";
import { getEnumFileName } from "./build-from-enum";
import { ItemOutput } from "./data-types";
import _ from "lodash";

export function getTableFileName(item: NVTable, extension?: string): string {
  return `./model/table/${item.name}${extension ?? ''}`;
}

export function buildTableDependency(table: NVTable, source: NVResult): string[] {
  return table.fields
    .filter((tc: NVTableField) => tc.type.kind === 'relation' || tc.type.kind === 'enum') // only table relation or enum
    .filter((tc: NVTableField) => !(tc.type.kind === 'relation' && tc.type.type == table.name)) // dont import yourself
    .map((tc: NVTableField) => {
      const type = tc.type;
      switch (type.kind) {
        case "native":
        case "enum":
          const enum_item = source.list_enum.find((m: NVEnum) => m.name === type.subtype)
          if (!enum_item) {
            throw new Error(`Enum "${type.subtype}" is not available on models`)
          }
          return `import { ${enum_item.name} } from '../.${getEnumFileName(enum_item)}'`;
        case 'relation':
          const table_item = source.list_table.find((m: NVTable) => m.name === type.type);
          if (!table_item) {
            throw new Error(`Table "${type.type}" is not available on models`);
          }
          return `import { ${table_item.name} } from '../.${getTableFileName(table_item)}'`;
      }
    });
}

export function mapSQLTypeToJSType(type: NVTableFieldType): string {
  switch (type.type) {
    case 'bigint':
    case 'int8':
    case 'bigserial':
    case 'serial8':
      return 'number';
    case 'boolean':
    case 'bool':
      return 'boolean';
    case 'box':
    case 'bytea':
    case 'cidr':
    case 'circle':
      return 'number';
    case 'date':
      return 'Date';
    case 'float':
    case 'float8':
      return 'number';
    case 'inet':
      return 'string';
    case 'integer':
    case 'int':
    case 'int4':
      return 'number';
    case 'json':
    case 'jsonb':
    case 'line':
    case 'lseg':
    case 'macaddr':
    case 'macaddr8':
      return 'string';
    case 'money':
      return 'number';
    case 'path':
      return 'string';
    case 'pg_lsn':
    case 'pg_snapshot':
    case 'point':
    case 'polygon':
      return 'string';
    case 'real':
    case 'float4':
    case 'smallint':
    case 'int2':
    case 'smallserial':
    case 'serial2':
    case 'serial':
    case 'serial4':
    case 'tinyint':
      return 'number';
    case 'text':
      return 'string';
    case 'timetz':
    case 'timestamptz':
      return 'Date';
    case 'tsquery':
    case 'tsvector':
    case 'txid_snapshot':
    case 'uuid':
    case 'xml':
    case 'bit':
    case 'varbit':
    case 'char':
    case 'varchar':
      return 'string';
    case 'numeric':
    case 'decimal':
      return 'number';
    case 'time':
    case 'timestamp':
    case 'abstime':
    case 'datetime':
    case 'interval':
    case 'reltime':
    case 'timespan':
      return 'Date';
  }
  throw new Error(`unsupported data type '${type.type}'`);
}

function buildDefaultValue(type: NVTableFieldType, column: NVTableField): string | undefined {
  switch (typeof type.default_value) {
    case "number":
    case "boolean":
      return String(type.default_value);
    case "string":
      if (column.type.kind === 'enum') {
        return type.default_value;
      }
      if (type.default_value.startsWith("'") || type.default_value.startsWith('"')) {
        return type.default_value;
      }
      return `() => "${type.default_value}"`;
  }
  return undefined;
}

export function buildColumnNative(type: NVTableFieldType, column: NVTableField, source: NVResult): string[] {
  const default_value_attr = buildDefaultValue(type, column);
  const is_required = !type.nullable;
  const has_default_value = default_value_attr !== undefined;
  const primary_key_attr = type.primary_key;
  const unique_attr = type.unique;
  const autoinc_attr = type.autoincrement;

  const is_numeric_or_decimal = ['numeric', 'decimal'].includes(type.type);
  const precision = is_numeric_or_decimal ? `precision: ${type.param1 || 'undefined'},` : '';
  const scale = is_numeric_or_decimal ? `scale: ${type.param2 || 'undefined'},` : '';

  const is_bit_varbit_char_varchar = ['bit', 'varbit', 'char', 'varchar'].includes(type.type);
  const length = is_bit_varbit_char_varchar ? `length: ${type.param1 || 'undefined'},` : '';

  const typeorm_decorator = [
    `@Column({`,
    ...[
      `type: '${type.type}',`,
      `nullable: ${is_required ? 'false' : 'true'},`,
      precision,
      scale,
      length,
      has_default_value ? `default: ${default_value_attr},` : ''
    ].filter(Boolean).map(line => '  ' + line),
    `})`,
  ];

  if (primary_key_attr) {
    if (autoinc_attr) {
      typeorm_decorator.push(`@PrimaryGeneratedColumn('increment')`);
    } else {
      typeorm_decorator.push(`@PrimaryColumn()`);
    }
  }

  if (unique_attr) {
    // something to do with unique
  }

  return [
    ...typeorm_decorator,
    `${column.column_name}${is_required ? '!' : '?'}: ${mapSQLTypeToJSType(type)};`
  ];
}

export function buildColumnEnum(type: NVTableFieldType, column: NVTableField): string[] {
  const default_value_attr = type.default_value;
  const is_required = !type.nullable;
  const has_default_value = default_value_attr !== undefined;

  const typeorm_decorator = [
    `@Column({`,
    ...[
      `type: 'enum',`,
      `enum: ${type.subtype},`,
      `nullable: ${is_required ? 'false' : 'true'},`,
      has_default_value ? `default: '${default_value_attr}',` : ''
    ].filter(Boolean).map(line => '  ' + line),
    `})`,
  ]

  return [
    ...typeorm_decorator,
    `${column.column_name}${is_required ? '!' : '?'}: ${type.subtype};`
  ];
}

export function buildColumnRelation(type: NVTableFieldType, column: NVTableField, table: NVTable, source: NVResult): string[] {
  const is_required = !type.nullable;

  const foreign_table = source.list_table.find((item: NVTable) => item.name === type.type);
  if (!foreign_table) {
    throw new Error(`Table "${type.type}" not found on relation "${table.name}.${column.column_name}"`);
  }
  const foreign_column = foreign_table.fields.find((fc: NVTableField) => fc.column_name === type.subtype);
  if (!foreign_column) {
    throw new Error(`Column "${type.subtype}" on table "${type.type}" not found on relation "${table.name}.${column.column_name}"`);
  }
  const one_to_many_field_name = `otm_${column.column_name}`;

  const typeorm_decorator = [
    `@ManyToOne(() => ${foreign_table.name}, x => x.${foreign_column.column_name}, { nullable: ${is_required ? 'false' : 'true'} })`,
    `@JoinColumn({ name: '${column.column_name}' })`,
    `${one_to_many_field_name}${(is_required && false /** relation object always optional */) ? '!' : '?'}: ${foreign_table.name};`,
    `@Column({`,
    ...[
      `name: '${column.column_name}',`,
      `type: '${foreign_column.type.type}',`,
      `nullable: ${is_required ? 'false' : 'true'},`,
    ].filter(Boolean).map(line => '  ' + line),
    `})`,
  ]

  return [
    ...typeorm_decorator,
    `${column.column_name}${is_required ? '!' : '?'}: ${mapSQLTypeToJSType(foreign_column.type)};`
  ];
}

export function buildColumn(column: NVTableField, table: NVTable, source: NVResult): string[] {
  switch (column.type.kind) {
    case "native": return buildColumnNative(column.type, column, source);
    case "enum": return buildColumnEnum(column.type, column);
    case "relation": return buildColumnRelation(column.type, column, table, source);
  }
}

export function buildFromTable(table: NVTable, source: NVResult): ItemOutput {
  return {
    files: [{
      filename: getTableFileName(table, '.ts'),
      content: [
        'import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn, BaseEntity } from "typeorm";',
        ..._.uniq(buildTableDependency(table, source)),
        '',
        `@Entity('${table.name}')`,
        `export class ${table.name} extends BaseEntity {`,
        ...table.fields
          .reduce((acc: string[], c: NVTableField) => [...acc, ...buildColumn(c, table, source)], [])
          .map(line => '  ' + line),
        `}`
      ].join('\n')
    }],
    map: {
      [table.name]: getTableFileName(table)
    }
  }
}
