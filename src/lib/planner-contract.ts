import type { Decision } from "./data";
import type { PlanConstraints, PlanSearch } from "./planner";
import type { testDelays } from "./resilience";
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
export interface PlannerReply {
  message: string;
  source: "openai" | "local";
  constraints: PlanConstraints;
  search: PlanSearch | null;
  stress: ReturnType<typeof testDelays> | null;
  focusMeasureId: string | null;
  notice?: string;
}
export interface PlannerRequest {
  mode: "chat" | "search";
  messages: ChatMessage[];
  constraints: PlanConstraints;
  decisions: Decision[];
  previousPlans: Decision[][];
}
