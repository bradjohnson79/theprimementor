import type { SystemName } from "../blueprint/types.js";

export type Divin8ConversationState =
  | "collecting_input"
  | "ready_for_engine"
  | "engine_running"
  | "interpreting"
  | "conversational";

export type Divin8ExecutionMode =
  | "timeline"
  | "timeline_multi_compatibility"
  | "compatibility_multi"
  | "compatibility"
  | "multi_system"
  | "standard";

/**
 * Deterministic routing plan from keyword/system detection (safety layer).
 * GPT-first orchestration maps this into `Divin8Decision` for execution.
 */
export interface Divin8RoutingPlan {
  needsEngine: boolean;
  missingFields: string[];
  systemsToRun: SystemName[];
  requestedSystems: string[];
  interpretiveSystems: string[];
  responseMode: "chat" | "engine";
  conversationState: Divin8ConversationState;
  mode: Divin8ExecutionMode;
  clarificationPrompt?: string;
  routingNotes: string[];
  unsupportedReason?: string;
  downgradedToGeneral?: boolean;
}
