import { AgentCap, executeAgentCapability } from "./agent-capability";
import { extractCodeBlocksAgent, ImplPlanResponse } from "./plan-preparation";

export async function executePlanAndGetNextPlan(impl: ImplPlanResponse, cwd: string, file_abs_path: string): Promise<ImplPlanResponse> {
  let res = 'error please fix your latest plan';
  while (true) {
    try {
      const execution_result = await executeAgentCapability(impl.instruction, cwd, file_abs_path);
      res = await impl.llm.ask(execution_result, impl.session.id);
      break;
    } catch (err: any) {
      const error = `There is an error when executing the plan: ${err.toString()}`;
      res = await impl.llm.ask(error, impl.session.id);
    }
  }
  while (true) {
    try {
      return {
        instruction: JSON.parse(extractCodeBlocksAgent(res)) as AgentCap,
        llm: impl.llm,
        session: impl.session
      };
    } catch (err: any) {
      const error = `There is an error on your plan response JSON format: ${err.toString()}`;
      res = await impl.llm.ask(error, impl.session.id);
    }
  }
}
