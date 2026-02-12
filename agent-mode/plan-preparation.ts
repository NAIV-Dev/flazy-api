import { ChatGPTLLM, LLMRunner } from "@graf-research/llm-runner";
import { AgentCap } from "./agent-capability";
import { getImplPrompt, ImplPromptParam } from "../prompt";

export interface ImplPlanResponse {
  instruction: AgentCap
  llm: ChatGPTLLM
  session: LLMRunner.ChatSession
}

export async function generateFirstImplementationPlan(param: ImplPromptParam, _llm_model?: string): Promise<ImplPlanResponse> {
  const secret_key = process.env.SK as string || '';
  const llm_model = _llm_model ?? 'google/gemini-3-flash-preview';
  const llm_endpoint = 'https://openrouter.ai/api/v1';
  const llm: ChatGPTLLM = new ChatGPTLLM(secret_key, llm_model as any, undefined, llm_endpoint);
  const session = llm.chat_session_manager.newSession();
  session.list_message.push({
    role: 'user',
    content: [
      `## Your main task`,
      `Implement function ${param.function_name} with description: "${param.description}" by creating first plan to execute task described, follow implementation guides below.`,
      '',
      '## Guide: How Write Plans',
      'Every plan has structure (typescript syntax) `AgenCap`, response with only single instruction one by one, after user response, give another instruction separately, until "finished" instruction.',
      '',
      '```ts',
      "export interface AgentCapListUtilityFiles { instruction: 'list-utility-file', description: string }",
      "export interface AgentCapWriteUtilityFile { instruction: 'write-utility-file', filename: string, content: string, description: string }",
      "export interface AgentCapReadUtilityFile { instruction: 'read-utility-file', filename: string, description: string }",
      "export interface AgentCapRemoveUtilityFile { instruction: 'remove-utility-file', filename: string, description: string }",
      "export interface AgentCapImplementFunction { instruction: 'implement-function', content: string, description: string }",
      "export interface AgentCapFinished { instruction: 'finished' }",
      "export type AgentCap = AgentCapListUtilityFiles | AgentCapReadUtilityFile | AgentCapRemoveUtilityFile | AgentCapWriteUtilityFile | AgentCapImplementFunction | AgentCapFinished;",
      '```',
      '',
      '## Guide: How to Write Main Code',
      getImplPrompt(param),
      '',
      "`instruction: 'implement-function'` is single instruction when you are ready to implement the main function from the main task",
      'If you are about to use environment variable or constants that have a chance for globally usage you should define the value by yourself (dont give mockup create real value) like example jwt secret key and put it on utility as a const',
      'Before write a utility function make sure it isnt redundant check list utility first',
      '',
      '## Example Response',
      '',
      'Example #1',
      '```json',
      '{',
      '  "instruction": "list-utility-file",',
      '  "description": "show list directory utility and I will decide next instruction based on list dir result"',
      '}',
      '```',
      '',
      'Example #2',
      '```json',
      '{',
      '  "instruction": "write-utility-file",',
      '  "filename": "auth-jwt.ts",',
      '  "content": "```ts\nexport function signJWT() ....\n```",',
      '  "description": "create file db.naiv with content of database structure for an online shop website"',
      '}',
      '```',
      '',
      '## Response Format',
      'Your response format must be json code-fenced begin with ```json and type structure `AgentCap` like above without free text or any additional text, only json format. Content code inside AgentCap.content must be in typescript format without codefence',
    ].join('\n')
  });

  return {
    instruction: await runLoop(llm, session.id),
    llm,
    session
  };
}

async function runLoop(llm: ChatGPTLLM, session_id: string, error_message?: string): Promise<AgentCap> {
  const response: string = await llm.ask(error_message ?? `write plan for task described above!`, session_id);
  try {
    const x = JSON.parse(extractCodeBlocksAgent(response)) as AgentCap;
    return x;
  } catch (err: any) {
    const error = `There is an error on your plan response JSON format: ${err.toString()}`;
    console.log('ERR1', { error });
    return await runLoop(llm, session_id, error);
  }
}

export function extractCodeBlocksAgent(text: string) {
  return text.startsWith('```') ?
    (
      /```(?:json)\b/i.test(text)
      ? [...text.matchAll(/```(?:json)\s*([\s\S]*?)```/gi)]
        .map(m => m[1])
        .join('\n')
      : ''
    )
    : text;
}
