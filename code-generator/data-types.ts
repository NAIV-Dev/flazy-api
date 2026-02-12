export type MapModelNameFilePath = { [key: string]: string };
export interface CodegenFileOutput {
  filename: string
  content: string
}

export interface ItemOutput {
  files: CodegenFileOutput[]
  map: MapModelNameFilePath
}