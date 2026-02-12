import path from "path"
import fs from 'fs';

export interface AgentCapListUtilityFiles {
  instruction: 'list-utility-file'
  description: string
}

export interface AgentCapWriteUtilityFile {
  instruction: 'write-utility-file'
  filename: string
  content: string
  description: string
}

export interface AgentCapReadUtilityFile {
  instruction: 'read-utility-file'
  filename: string
  description: string
}

export interface AgentCapRemoveUtilityFile {
  instruction: 'remove-utility-file'
  filename: string
  description: string
}

export interface AgentCapImplementFunction {
  instruction: 'implement-function'
  content: string
  description: string
}

export interface AgentCapFinished {
  instruction: 'finished'
}

export type AgentCap = AgentCapListUtilityFiles
  | AgentCapReadUtilityFile
  | AgentCapRemoveUtilityFile
  | AgentCapWriteUtilityFile
  | AgentCapImplementFunction
  | AgentCapFinished;

export async function executeAgentCapability(cap: AgentCap, cwd: string, file_abs_path: string): Promise<string> {
  console.log(`execute ${cap.instruction} - ${(cap as any).description || ''}`);
  const utility_abs_dir_path = path.resolve(cwd, `__flazy/utility`);
  switch (cap.instruction) {
    case "list-utility-file":
      try {
        if (!fs.existsSync(utility_abs_dir_path)) {
          await fs.promises.mkdir(utility_abs_dir_path);
        }
        const list_dir = ListDir(utility_abs_dir_path, cwd);
        return list_dir.length == 0 ? 'Empty directory' : list_dir.join('\n');
      } catch (err: any) {
        throw new Error((err.toString() as string).replace(new RegExp(cwd, 'g'), ''));
      }
    case "read-utility-file":
      return await fs.promises.readFile(path.resolve(utility_abs_dir_path, cap.filename), 'utf-8');
    case "remove-utility-file":
      await fs.promises.rm(path.resolve(utility_abs_dir_path, cap.filename), { force: true });
      return `Utility file ${cap.filename} deleted.`;
    case "write-utility-file":
      if (!fs.existsSync(utility_abs_dir_path)) {
        await fs.promises.mkdir(utility_abs_dir_path);
      }
      await fs.promises.writeFile(path.resolve(utility_abs_dir_path, cap.filename), cap.content);
      return `Utility file ${cap.filename} successfully created.`;
    case "implement-function":
      await fs.promises.writeFile(file_abs_path, cap.content);
      return `Function successfully creatd`;
    case "finished":
      return 'Finished.';
  }
}

export function ListDir(target_path: string, cwd: string): string[] {
  function getAllFilesRecursive(dirPath: string, excludedFolders = new Set()): string[] {
    let filesList: string[] = [];

    // Check if the current directory should be excluded
    const folderName = path.basename(dirPath);
    if (excludedFolders.has(folderName)) {
      return filesList; // Skip this directory and all its contents
    }

    const files = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);

      if (file.isDirectory()) {
        // Recursively call the function for subdirectories
        filesList = filesList.concat(getAllFilesRecursive(fullPath, excludedFolders));
      } else {
        // Add the file to the list
        filesList.push(fullPath.replace(/\"/g, ''));
      }
    }

    return filesList;
  }

  const foldersToExclude = new Set(['node_modules', '.git', '.cache']);
  return getAllFilesRecursive(path.resolve(cwd, target_path), foldersToExclude).map(p => p.replace(cwd.endsWith('/') ? cwd : (cwd + '/'), ''));
}
