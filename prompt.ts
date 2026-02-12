export interface ImplPromptParam {
  function_name: string
  types_relative_path: string
  target_implementation_path: string
  types_content: string
  description: string
  model_files_list: string[]
  blueprint: string
}
function codefence(code: string) {
  return `\`\`\`\n${code.trim()}\n\`\`\``;
}
export function getImplPrompt(param: ImplPromptParam) {
  const function_name_first_lowcase = `${param.function_name[0].toLowerCase()}${param.function_name.slice(1)}`;
  return `
This is a system blueprint that will related to the task

${codefence(param.blueprint)}

Look at this types and signature ${param.function_name} of an API:

File location: ${param.types_relative_path}

${codefence(param.types_content)}

TypeORM models available on this files location:

${param.model_files_list.map(x => `- ${x}`).join('\n')}

Your task: implement function that satisfies that types and signature. This function should do: "${param.description}".

This is an example of my expectation how you will implement the function:

${codefence(`
import { SomeModel } from "../__types__/model/table/SomeModel";
import { someutility } from "../utility/myutility";

export const ${function_name_first_lowcase}: ${param.function_name} = async req => {
  // implement function here...
}
`)}

You dont need to initialize AppDataSource or use getRepository to get model, just use the model directly since it already extends BaseEntity.
Function name ${function_name_first_lowcase} is intentional and must be exactly same, do not change.

Do not import third party library unless it built-in nodejs library and jsonwebtoken and bcryptjs available, instead of other third party library use built-in alternative or just give mockup code/result.

please return only typescript code with code fence block without any other strings but typescript code!

`.trim();
}

// console.log(getImplPrompt({
//   function_name: "T_getProductList",
//   types_relative_path: "__flazy/__types__/api/T_getProductList.ts",
//   target_implementation_path: "__flazy/original-implementation/T_getProductList.ts",
//   types_content: `
// import { Response } from "express";
// import { ClassConstructor, Transform, Type, plainToInstance } from "class-transformer";
// import { IsNotEmpty, IsNumber, IsObject, IsBoolean, IsOptional, IsISO8601, IsString, IsEnum, ValidateNested, IsArray, ValidationError, validateOrReject } from "class-validator";
// import { Product } from '../model/table/Product'

// class ReturnType_0 {
//   @IsNotEmpty({ message: 'total cannot be empty' })
//   @Transform((param?: any): number | null => (param?.value === null || param?.value === undefined || param?.value === '') ? null : parseFloat(param.value))
//   @IsNumber({}, { message: 'total must be a number (decimal)' })
//   total!: number
//   @IsNotEmpty({ message: 'data cannot be empty' })
//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => Product)
//   data!: Product[]
// }

// export type T_getProductList = (request: {

// }, response: Response) => Promise<ReturnType_0>;

// export const method = 'get';
// export const url_path = '/product';
// export const alias = 'T_getProductList';
// export const is_streaming = false;
// `.trim(),
//   description: "get list of products",
//   model_files_list: [
//     '__flazy/__types__/model/Product.ts',
//     '__flazy/__types__/model/User.ts'
//   ]
// }))
