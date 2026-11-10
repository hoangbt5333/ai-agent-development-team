import {
  ReviewResultSchema,
  type ReviewResult
} from "../schemas/review.schema.js";

export function validateReviewResult(
  result: unknown
): ReviewResult {
  return ReviewResultSchema.parse(result);
}