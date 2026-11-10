import { z } from "zod";

export const PlannerResultSchema = z.object({
  plan: z
    .array(z.string())
    .min(1)
    .describe("Danh sách các bước cần thực hiện theo thứ tự"),
});

export type PlannerResult = z.infer<typeof PlannerResultSchema>;