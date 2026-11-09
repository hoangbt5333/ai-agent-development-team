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

// 1. Define State
const AgentState = new StateSchema({
  task: z.string(),
  plan: z.array(z.string()).default(() => []),
  analysis: z.string().default(""),
  requiresDevelopment: z.boolean().default(false),
  approved: z.boolean().default(false)
});

// 2. Planner Node
const plannerNode = async (
  state: typeof AgentState.State
) => {
  console.log("Planner is working...");

  return {
    plan: [
      "Analyze project architecture",
      "Identify affected files",
      "Define implementation steps"
    ]
  };
};

// 3. Analyst Node
const analystNode = async (
  state: typeof AgentState.State
) => {
  console.log("Analyst is working...");

  const task = state.task.toLowerCase();

  const requiresDevelopment =
    task.includes("implement") ||
    task.includes("build");

  return {
    analysis: `Analyzed task: ${state.task}.
Plan contains ${state.plan.length} steps.`,
    requiresDevelopment
  };
};

// Development Node
const developerNode = async (
  state: typeof AgentState.State
) => {
  console.log("Developer is working...");

  return {
    analysis:
      state.analysis +
      "\nDeveloper implementation completed."
  };
};

// Human Review Node
const humanReviewNode = async (
  state: typeof AgentState.State
) => {
  console.log("Waiting for human approval...");

  const decision = interrupt({
    message: "Please review the implementation plan",
    task: state.task,
    plan: state.plan
  });

  return {
    approved: decision === "approve"
  };
};

// Hàm điều hướng
const routeAfterAnalyst = (
  state: typeof AgentState.State
) => {
  return state.requiresDevelopment
    ? "developer"
    : END;
};

const routeAfterReview = (
  state: typeof AgentState.State
) => {
  return state.approved
    ? "developer"
    : END;
};

// 4. Build Graph
const checkpointer = new MemorySaver();

const graph = new StateGraph(AgentState)
  .addNode("planner", plannerNode)
  .addNode("analyst", analystNode)
  .addNode("humanReview", humanReviewNode)
  .addNode("developer", developerNode)

  .addEdge(START, "planner")
  .addEdge("planner", "analyst")
  .addEdge("analyst", "humanReview")

  .addConditionalEdges(
    "humanReview",
    routeAfterReview
  )

  .addEdge("developer", END)

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
        task: "Implement User Management feature"
    },
    config
  );

  console.log("Workflow paused:", result);

  const resumeResult = await graph.invoke(
  new Command({
    resume: "approve"
  }),
  config
);

console.log("Workflow completed:", resumeResult);


}

main().catch((error) => {
  console.error(error);
//   process.exitCode = 1;
});