import { prompt } from "enquirer";
import { Listr } from "listr2";
import fs from 'fs';
import path from 'path';
import { ChatGPTLLM } from "@graf-research/llm-runner";
import { naiv_parser } from "@naiv/core";
import { cwd } from 'process';

export async function cmdChat(_llm_model?: string) {
  const filename = `api-specification.naiv`;
  const file_abs_path = path.resolve(cwd(), filename);
  let code = '';
  if (fs.existsSync(file_abs_path)) {
    code = await fs.promises.readFile(file_abs_path, 'utf-8');
    console.warn(`File ${file_abs_path} is exist, this file will be modified by your instruction.`);
  }
  const answers: { prompt: string } = await prompt([{
    type: "input",
    name: "prompt",
    message: `Explain briefly your API program`,
  }]);
  let success_compiled = false;
  const secret_key = process.env.SK as string || '';
  const llm_model = _llm_model ?? 'google/gemini-3-flash-preview';
  const llm_endpoint = 'https://openrouter.ai/api/v1';
  const llm: ChatGPTLLM = new ChatGPTLLM(secret_key, llm_model as any, undefined, llm_endpoint);
  let attempt = 0;
  let error_message = '';
  let stime = performance.now();
  do {
    await new Listr([{
      title: attempt > 0 ? "Fixing error specification NAIV DSL" : code ? "Updating existing NAIV file" : "Generating data & API specification",
      rendererOptions: {
        persistentOutput: true,
      },
      task: async () => {
        const prompt = await generatePrompt(answers.prompt, code, error_message);
        const response = await llm.askNoContext(prompt);
        code = extractCodeBlocks(response);
        try {
          success_compiled = Boolean(naiv_parser(code));
        } catch (err: any) {
          error_message = err?.message || '';
          console.log(error_message)
        }
      }
    }]).run();
    attempt++;
  } while (!success_compiled);

  let ftime = performance.now();
  let elapsed_time = (ftime - stime) / 1000;
  await new Listr([{
    title: "Writing specification file",
    rendererOptions: {
      persistentOutput: true,
    },
    task: async () => {
      await fs.promises.writeFile(file_abs_path, code);
    }
  }, {
    title: `Successfully created 'api-specification.naiv' (${elapsed_time.toFixed(2)}s)`,
    rendererOptions: {
      persistentOutput: true,
    },
    task: async () => {
      await fs.promises.writeFile(file_abs_path, code);
    }
  }]).run();
}

async function generatePrompt(instruction: string, generated_code?: string, error_message?: string) {
  const naiv_instruction = await fs.promises.readFile(path.resolve(__dirname, '../../NAIV-INSTRUCTION.md'), 'utf-8');
  if (error_message && generated_code) {
    return `
Read this NAIV DSL carefully

${naiv_instruction}

--

An LLM generated this code on the context "${instruction}".

\`\`\`naiv
${generated_code}
\`\`\`

but there is an error: ${error_message}.

Your task: fix the error and create naiv database and api dsl code in a single file based on the context "${instruction}".

please return only naiv code with code fence block without any other strings but typescript code! your code fence block must starts with "\`\`\`naiv" and ends with "\`\`\`"
`.trim();  
  }

  if (generated_code) {
    return `
Read this NAIV DSL carefully

${naiv_instruction}

--

Your task: modify existing naiv database and api dsl code below based on the context "${instruction}".

Existing naiv design

\`\`\`naiv
${generated_code}
\`\`\`

please return only naiv code with code fence block without any other strings but typescript code! your code fence block must starts with "\`\`\`naiv" and ends with "\`\`\`"
`.trim();
  }

  return `
Read this NAIV DSL carefully

${naiv_instruction}

--

Your task: create naiv database and api dsl code in a single file based on the context "${instruction}".

please return only naiv code with code fence block without any other strings but typescript code! your code fence block must starts with "\`\`\`naiv" and ends with "\`\`\`"
`.trim();
}


function extractCodeBlocks(text: string) {
  return /```(?:naiv|dsl)\b/i.test(text)
    ? [...text.matchAll(/```(?:naiv|dsl)\s*([\s\S]*?)```/gi)]
      .map(m => m[1])
      .join('\n')
    : '';
}
