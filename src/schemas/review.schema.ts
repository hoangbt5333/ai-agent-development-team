import { z } from "zod";

export const ReviewIssueSchema = z.object({
  file: z.string(),

  severity: z.enum([
    "low",
    "medium",
    "high",
    "critical"
  ]),

  description: z.string()
});

export const ReviewResultSchema = z.object({
  status: z.enum([
    "approved",
    "changes_requested"
  ]),

  issues: z.array(ReviewIssueSchema),

  summary: z.string()
});

export type ReviewIssue =
  z.infer<typeof ReviewIssueSchema>;

export type ReviewResult =
  z.infer<typeof ReviewResultSchema>;