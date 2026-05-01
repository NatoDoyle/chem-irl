// User-facing copy for the Iris feature. Centralised so tone changes
// don't require chasing strings through screen files.
//
// NOT to be confused with the AI system prompt, which lives in the
// edge function (supabase/functions/iris-chat/system-prompt.ts) and is
// never sent from the client.

export const IRIS_NAME = 'Iris';

// ── Onboarding entry point ──────────────────────────────────────────────

export const IRIS_INTRO_TITLE = 'Want a hand from Iris?';
export const IRIS_INTRO_BODY =
  "I'll ask a few questions and turn what you tell me into a bio that " +
  'actually sounds like you. Five minutes, optional, you can skip anytime.';
export const IRIS_INTRO_START_CTA = 'Talk to Iris';
export const IRIS_INTRO_SKIP_CTA = 'Maybe later';

// ── Paywall ─────────────────────────────────────────────────────────────

export const PAYWALL_HEADLINE = 'Iris is part of Chem Plus';
export const PAYWALL_BODY =
  "Iris helps you write a profile that sounds like you, plan dates that " +
  "actually happen, and reply to chats without staring at the screen for " +
  "ten minutes. Three days free. Cancel anytime.";
export const PAYWALL_TRIAL_CTA = 'Start 3-day free trial';
export const PAYWALL_SUB_CTA = 'Subscribe to Chem Plus';
export const PAYWALL_DISMISS_CTA = 'Not now';

export const TRIAL_BANNER_TEMPLATE = (daysLeft: number): string => {
  if (daysLeft <= 0) return 'Trial ended';
  if (daysLeft === 1) return '1 day left in your trial';
  return `${daysLeft} days left in your trial`;
};

// ── Consent (chat coach) ────────────────────────────────────────────────

export const CHAT_COACH_CONSENT_TITLE = 'Let Iris read this thread?';
export const CHAT_COACH_CONSENT_BODY =
  "To help with replies, Iris needs to see the recent messages between " +
  "you and your match. The match isn't told. You can turn this off anytime " +
  'in Profile → Iris.';
export const CHAT_COACH_CONSENT_AGREE = 'OK, let her see it';
export const CHAT_COACH_CONSENT_DECLINE = 'Not for this thread';

// ── Generic chat UI ─────────────────────────────────────────────────────

export const IRIS_INPUT_PLACEHOLDER = 'Tell Iris…';
export const IRIS_SEND_LABEL = 'Send';
export const IRIS_THINKING_LABEL = `${IRIS_NAME} is thinking…`;
export const IRIS_ERROR_GENERIC = "Iris hit a snag. Try again in a moment.";

// ── Tool-result CTAs (matches the tool names in system-prompt.ts) ──────

export const TOOL_BIO_DRAFT_USE = 'Use this bio';
export const TOOL_BIO_DRAFT_DISMISS = 'Try a different draft';
export const TOOL_TIME_WINDOW_USE = 'Use this time';
export const TOOL_REPLY_DRAFT_USE = 'Use this reply';
