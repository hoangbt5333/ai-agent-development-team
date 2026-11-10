import "dotenv/config";
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PlannerResultSchema } from "../schemas/planner.schema.js";

export interface PlannerInputState {
  task: string;
  [key: string]: any;
}

export interface CreatePlannerNodeOptions {
  model?: BaseChatModel;
  apiKey?: string;
  modelName?: string;
  temperature?: number;
}

/**
 * Khởi tạo Claude model mặc định từ biến môi trường
 */
function getDefaultClaudeModel(options?: CreatePlannerNodeOptions): ChatAnthropic {
  const apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_anthropic_api_key_here") {
    console.warn("⚠️  Warning: ANTHROPIC_API_KEY is not configured in .env");
  }

  return new ChatAnthropic({
    apiKey: apiKey || "dummy_key_for_init",
    model: options?.modelName ?? process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest",
    temperature: options?.temperature ?? 0,
  });
}

/**
 * Factory function tạo planner node cho LangGraph bằng Claude
 */
export function createPlannerNode(
  modelOrOptions?: BaseChatModel | CreatePlannerNodeOptions
) {
  let model: BaseChatModel;

  if (modelOrOptions && "invoke" in modelOrOptions) {
    model = modelOrOptions;
  } else {
    model = getDefaultClaudeModel(modelOrOptions as CreatePlannerNodeOptions);
  }

  const plannerModel = (model as any).withStructuredOutput(
    PlannerResultSchema,
    {
      name: "planner_result",
    }
  );

  return async function plannerNode(state: PlannerInputState) {
    console.log("Claude Planner is working...");

    const result = await plannerModel.invoke([
      {
        role: "system",
        content: `
        You are a senior software project planner.

        Your job is to:
        1. Understand the software development task.
        2. Break it into clear, ordered implementation steps.
        3. Make the steps practical and specific.
        4. Do not implement code.
        5. Do not assume files or features exist unless stated.

        Return a structured plan.
      `,
      },
      {
        role: "user",
        content: `Analyze this task and create an implementation plan:

      ${state.task}`,
      },
    ]);

    return {
      plan: result.plan,
    };
  };
}

/**
 * Planner node mặc định sử dụng Claude
 */
export const plannerNode = async (state: PlannerInputState) => {
  const node = createPlannerNode();
  return node(state);
};
