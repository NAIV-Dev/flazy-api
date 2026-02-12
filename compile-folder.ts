import ts from "typescript";
import path from "path";
import fs from "fs";
import { globSync } from "glob";

interface CompileParam {
  source_abs_folder_path: string
  target_abs_folder_path?: string
  clean_after_compiled?: boolean
  replace_keywords?: {[key: string]: string}
}
export async function compileAndClean(param: CompileParam) {
  const target_abs_folder_path = param.target_abs_folder_path ?? param.source_abs_folder_path;
  if (!path.isAbsolute(param.source_abs_folder_path)) {
    throw new Error("Path must be absolute");
  }

  if (!fs.existsSync(param.source_abs_folder_path)) {
    throw new Error("Folder does not exist");
  }

  // console.log("Compiling:", param.source_abs_folder_path);

  // Find all .ts files
  const tsFiles = globSync("**/*.ts", {
    cwd: param.source_abs_folder_path,
    absolute: true,
    ignore: ["**/node_modules/**"]
  });

  if (!tsFiles.length) {
    return;
  }

  // Create TS program
  const program = ts.createProgram(tsFiles, {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    outDir: target_abs_folder_path,
    rootDir: param.source_abs_folder_path,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    useDefineForClassFields: false,
    esModuleInterop: true,
    strict: true,
    noEmitOnError: false
  });

  // Compile
  const emitResult = program.emit();

  // const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
  // diagnostics.forEach(d => {
  //   console.error(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  // });

  if (emitResult.emitSkipped) {
    throw new Error("Compilation failed");
  }
  // console.log("Compilation done.");

  if (param.replace_keywords) {
    const jsFiles = globSync("**/*.js", {
      cwd: param.target_abs_folder_path,
      absolute: true,
      ignore: ["**/node_modules/**"]
    });
    const keys = Object.keys(param.replace_keywords);
    for (const file of jsFiles) {
      let content = await fs.promises.readFile(file, 'utf-8');
      for (const key of keys) {
        content = content.replace(new RegExp(key, 'g'), param.replace_keywords[key]);
      }
      await fs.promises.writeFile(file, content);
    }
  }

  if (param.clean_after_compiled) {
    // Remove .ts files
    for (const file of tsFiles) {
      await fs.promises.rm(file);
    }
    // console.log("TS files removed.");
  }
}

interface CompileSingleFileParam {
  source_root_folder_abs_path: string
  source_abs_file_path: string
  target_root_folder_abs_path: string
}
export async function compileSingleFile(param: CompileSingleFileParam) {
  if (!path.isAbsolute(param.source_abs_file_path)) {
    throw new Error("Path must be absolute");
  }

  if (!fs.existsSync(param.source_abs_file_path)) {
    throw new Error("This function is not implemented yet!");
  }

  // console.log("Compiling:", param.source_abs_file_path);

  const program = ts.createProgram([param.source_abs_file_path], {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,

    rootDir: param.source_root_folder_abs_path,
    outDir: param.target_root_folder_abs_path,

    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    useDefineForClassFields: false,
    esModuleInterop: true,
    strict: true,
    noEmitOnError: false,
  });


  // Compile
  const emitResult = program.emit();

  // const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
  // diagnostics.forEach(d => {
  //   console.error(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  // });

  if (emitResult.emitSkipped) {
    throw new Error("Compilation failed");
  }
  // console.log("Compilation done.");
}
