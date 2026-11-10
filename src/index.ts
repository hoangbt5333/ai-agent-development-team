import "dotenv/config";
import {
  StateGraph,
  StateSchema,
  START,
  END,
  MemorySaver,
  interrupt,
  Command
} from "@langchain/langgraph";

import * as z from "zod";
import { ChatAnthropic } from "@langchain/anthropic";
import { createPlannerNode } from "./nodes/planner.node.js";

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicApiKey || anthropicApiKey === "your_anthropic_api_key_here") {
  console.warn("⚠️  Warning: ANTHROPIC_API_KEY is missing or using placeholder in .env.");
}

const claudeModel = new ChatAnthropic({
  apiKey: anthropicApiKey || "dummy_key_for_init",
  model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest",
  temperature: 0,
});

const plannerNode = createPlannerNode(claudeModel);

// 1. Define State
const AgentState = new StateSchema({
  // Thông tin task
  task: z.string(),

  // Planner
  plan: z.array(z.string()).default(() => []),

  // Analyst
  analysis: z.string().default(""),

  // Human approval
  approved: z.boolean().default(false),

  // Developer
  implementation: z.string().default(""),

  // Reviewer
  reviewStatus: z.enum([
    "pending",
    "approved",
    "changes_requested"
  ]).default("pending"),

  reviewFeedback: z.string().default(""),

  // Số lần Developer sửa code
  revisionCount: z.number().default(0),

  // Documentation
  documentation: z.string().default("")
});

// 3. Analyst Node
const analystNode = async (
  state: typeof AgentState.State
) => {
  console.log("Analyst is working...");

  return {
    analysis: `Task: ${state.task}
Plan steps: ${state.plan.length}
Target feature: User Management`
  };
};

// Human Review Node
const humanReviewNode = async (
  state: typeof AgentState.State
) => {
  console.log("Waiting for human approval...");

  const decision = interrupt({
    task: state.task,
    plan: state.plan,
    analysis: state.analysis
  });

  return {
    approved: decision === "approve"
  };
};

// Development Node
const developerNode = async (
  state: typeof AgentState.State
) => {
  console.log("Developer is working...");

  const nextRevision = state.revisionCount + 1;

  return {
    implementation:
      `User Management implementation, revision ${nextRevision}`,

    revisionCount: nextRevision
  };
};

// Reviewer Node
const reviewerNode = async (
  state: typeof AgentState.State
) => {
  console.log("Reviewer is working...");

  if (state.revisionCount < 2) {
    return {
      reviewStatus: "changes_requested" as const,
      reviewFeedback:
        "Please improve validation and error handling."
    };
  }

  return {
    reviewStatus: "approved" as const,
    reviewFeedback: "Implementation looks good."
  };
};

// Documentation Node
const documentationNode = async (
  state: typeof AgentState.State
) => {
  console.log("Documentation is working...");

  return {
    documentation:
      `Documentation for ${state.task}\n` +
      `Implementation: ${state.implementation}\n` +
      `Review: ${state.reviewFeedback}`
  };
};


// Điều hướng sau khi Human Review
const routeAfterHumanReview = (
  state: typeof AgentState.State
): "developer" | typeof END => {
  return state.approved ? "developer" : END;
};

// Điều hướng sau khi Reviewer
const routeAfterReviewer = (
  state: typeof AgentState.State
): "developer" | "documentationWriter" | "escalation" => {
  if (state.reviewStatus === "approved") {
    return "documentationWriter";
  }

  if (state.revisionCount < 3) {
    return "developer";
  }

  return "escalation";
};

const escalationNode = async (
  state: typeof AgentState.State
) => {
  console.log("Escalating to human...");

  return {
    reviewFeedback:
      state.reviewFeedback +
      "\nMaximum revision limit reached. Human intervention required."
  };
};

// 4. Build Graph
const checkpointer = new MemorySaver();

const graph = new StateGraph(AgentState)
  .addNode("planner", plannerNode)
  .addNode("analyst", analystNode)
  .addNode("humanReview", humanReviewNode)
  .addNode("developer", developerNode)
  .addNode("reviewer", reviewerNode)
  .addNode("documentationWriter", documentationNode)
  .addNode("escalation", escalationNode)

  .addEdge(START, "planner")
  .addEdge("planner", "analyst")
  .addEdge("analyst", "humanReview")

  .addConditionalEdges(
    "humanReview",
    routeAfterHumanReview
  )

  .addEdge("developer", "reviewer")

  .addConditionalEdges(
    "reviewer",
    routeAfterReviewer
  )

  .addEdge("documentationWriter", END)
  .addEdge("escalation", END)

  .compile({ checkpointer });

// 5. Run Graph
const config = {
    configurable: {
        thread_id: "SM-25"
    }
}

async function main() {
  const result = await graph.invoke(
    {
      task: "Implement User Management feature for Admin role"
    },
    {
      configurable: {
        thread_id: "SM-25"
      }
    }
  );

  console.log("Workflow result:", result);
}

main().catch((error) => {
  console.error(error);
//   process.exitCode = 1;
});