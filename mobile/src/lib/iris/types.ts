// Iris types shared across the mobile client.
//
// These mirror the wire shapes returned by the iris-chat edge function.
// Keep this file dependency-free so it can be imported from any layer
// without bringing in network or storage code.

export const IRIS_SURFACES = {
  Interview: 'interview',
  ProfilePolish: 'profile_polish',
  DateOrganiser: 'date_organiser',
  ChatCoach: 'chat_coach',
} as const;
export type IrisSurface = (typeof IRIS_SURFACES)[keyof typeof IRIS_SURFACES];

export const IRIS_OPS = {
  Turn: 'turn',
  Finalize: 'finalize',
} as const;
export type IrisOp = (typeof IRIS_OPS)[keyof typeof IRIS_OPS];

// --- Streamed events surfaced from the SSE parser -----------------------

// Plain text delta produced by Anthropic's `content_block_delta`/`text_delta`
// events. Concatenated by the consumer to render the assistant's reply.
export interface IrisTextDelta {
  type: 'text';
  text: string;
}

// Anthropic tool-use blocks come through as `content_block_start` /
// `content_block_delta` (`input_json_delta`) / `content_block_stop` triples.
// We accumulate them into one ToolCall event emitted at content_block_stop.
export interface IrisToolCall {
  type: 'tool_use';
  name: string;
  input: Record<string, unknown>;
}

// Emitted exactly once at the end of the stream. Carries the
// conversation_id that was created or reused.
export interface IrisStreamDone {
  type: 'done';
  conversationId: string;
}

// Emitted for any non-fatal stream issue we want to surface (parse errors,
// upstream non-JSON SSE payloads). The consumer typically logs and
// continues; the stream still ends with `done`.
export interface IrisStreamWarning {
  type: 'warning';
  message: string;
}

export type IrisStreamEvent = IrisTextDelta | IrisToolCall | IrisStreamDone | IrisStreamWarning;

// --- Entitlement (mirrors iris_can_use() in PR 1) -----------------------

export const IRIS_ENTITLEMENT_REASONS = {
  Unauthenticated: 'unauthenticated',
  NeverSubscribed: 'never_subscribed',
  Trial: 'trial',
  Subscribed: 'subscribed',
  Expired: 'expired',
} as const;
export type IrisEntitlementReason =
  (typeof IRIS_ENTITLEMENT_REASONS)[keyof typeof IRIS_ENTITLEMENT_REASONS];

export interface IrisEntitlement {
  allowed: boolean;
  reason: IrisEntitlementReason;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
}

// --- Trial bootstrap (mirrors iris_start_trial()) -----------------------

export interface IrisTrialResult {
  success: boolean;
  alreadyExisted: boolean;
  status: 'trialing' | 'active' | 'grace_period' | 'expired' | 'cancelled';
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
}

// --- Memory patch returned by `op:'finalize'` ---------------------------

export interface IrisOceanScore {
  score: number;
  confidence: number;
}
export interface IrisOceanScores {
  O?: IrisOceanScore;
  C?: IrisOceanScore;
  E?: IrisOceanScore;
  A?: IrisOceanScore;
  N?: IrisOceanScore;
}

export interface IrisMemoryPatch {
  facts?: Record<string, unknown>;
  ocean_scores?: IrisOceanScores;
  mark_interview_completed?: boolean;
}

// --- Tool-call payloads (typed for the surfaces we know about) ----------
//
// These describe the *expected* shape of `IrisToolCall.input` for each
// tool the system prompt declares. The runtime cannot guarantee Claude
// honours the schema; consumers should validate before applying.

export interface ProposeBioDraftInput {
  bio: string;
  prompt_drafts: { question: string; answer: string }[];
  signoff_text: string;
}

export interface ProposeTimeWindowInput {
  day: string;
  start: string;
  end: string;
  date_type: string;
}

export interface ProposeReplyDraftInput {
  drafts: { text: string; vibe: string }[];
}
