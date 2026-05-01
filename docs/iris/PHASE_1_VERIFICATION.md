# Iris Phase 1 — Verification Runbook

This is the manual sign-off checklist for Iris Phase 1 (PRs #58–#64). It
exists because Iris's value comes from emergent behaviour (a real
conversation), and most of that cannot be asserted from a unit test —
it has to be exercised on a real device with a real Supabase project
and a real Anthropic API key.

Run this after all seven PRs have merged to `main` and the migrations
are applied to the staging Supabase project.

## Pre-flight

| ✓ | Item |
| --- | --- |
|   | `ANTHROPIC_API_KEY` is set in the staging Supabase project secrets |
|   | `supabase migration list --linked` shows `20260501000001`, `20260501000002`, `20260501000003` applied |
|   | `supabase functions list` shows `iris-chat` and `validate-subscription` deployed |
|   | iOS sandbox account configured for `chem_plus_monthly`; `chem_plus_monthly` registered in App Store Connect |
|   | Android: `chem_plus_monthly` registered in Play Console as an auto-renewable subscription |

## Database (PR #58)

| ✓ | Step | Expected |
| --- | --- | --- |
|   | Sign in as user A. `select * from iris_conversations where user_id = '<user B>'` via Supabase MCP. | `0 rows`. RLS holds. |
|   | Same as above against `iris_memory` and `subscriptions`. | `0 rows` each. |
|   | Call `iris_can_use()` from a fresh authenticated session. | Returns `{allowed: false, reason: 'never_subscribed'}`. |
|   | Call `iris_start_trial()`. | Returns `{success: true, already_existed: false, status: 'trialing', trial_ends_at: <NOW + 3d>}`. |
|   | Call `iris_start_trial()` again. | Returns `{success: true, already_existed: true, ...}`. No second row inserted. |
|   | `update subscriptions set trial_ends_at = now() - interval '1 day' where user_id = ...`. Call `iris_can_use()`. | Returns `{allowed: false, reason: 'expired', ...}`. |
|   | From a service-role SQL session, call `iris_get_memory('<uuid>')` for a user with no memory row. | Returns `{facts: {}, ocean_scores: {}, interview_completed_at: null, version: 1}`. |
|   | From the `authenticated` role, attempt `select iris_get_memory('<some uuid>')`. | Permission denied (REVOKE took effect). |
|   | Call `iris_apply_memory_patch('<uuid>', '{"facts": {"x": 1}}'::jsonb)` from service role twice. | First call inserts; second shallow-merges (`facts.x = 1` preserved). |

## Edge functions (PR #59)

| ✓ | Step | Expected |
| --- | --- | --- |
|   | POST to `/iris-chat` without `Authorization`. | 401 `missing_authorization`. |
|   | POST as a user with no subscription row. | 402 `not_entitled` with `reason: 'never_subscribed'`. |
|   | POST a `turn` op with `surface: 'interview'` for a trialing user. | Stream begins; first chunk is Anthropic `message_start`. `X-Iris-Conversation-Id` header set. |
|   | After streaming completes, `select * from iris_messages where conversation_id = ...`. | Two rows: user (role='user', content.text matches sent message) + assistant (role='assistant', tokens_in/out > 0). |
|   | Send a second `turn` with the same `conversation_id`. | Stream succeeds. `iris_conversations.cache_read_tokens > 0` (prompt caching working). |
|   | Send 60+ user-turns within 5 minutes. | After cap, returns 429 `rate_limited`. |
|   | POST a `finalize` op with the `conversation_id`. | Returns `{ok: true, patch: {...}}`. `iris_conversations.status = 'completed'`. `iris_memory.facts` and `ocean_scores` populated. |
|   | POST a duplicate `originalTransactionId` to `validate-subscription`. | Idempotent: same row, `last_validated_at` updated, no constraint error. |

## Mobile lib + components (PRs #60, #61)

| ✓ | Step | Expected |
| --- | --- | --- |
|   | `bun run lint -- --max-warnings 0` from `mobile/`. | Exit 0. |
|   | `bun run type-check` from `mobile/`. | Exit 0. |
|   | `bun test` from `mobile/`. | Includes `subscription.test.ts` from PR 7; all green. |
|   | `getEntitlement()` on a fresh signup. | `{allowed: false, reason: 'never_subscribed'}`. |
|   | `startTrial()` then `getEntitlement()`. | `allowed: true, reason: 'trial', trialEndsAt: <+3d>`. |
|   | Drop `<IrisLaunchButton surface="interview" />` into a debug screen. Tap it. | Paywall shows. |
|   | Tap "Start 3-day free trial" in the paywall. | Paywall closes; chat modal opens immediately. |
|   | Send a turn. | Assistant bubble visibly streams character-by-character. |
|   | When Iris emits a `propose_bio_draft` tool call, tap "Use this bio". | `onBioDraft` callback fires with the structured input. Modal closes. |
|   | Close the modal mid-stream. | `AbortController` cancels the upstream request; no orphan SSE connection. |

## Onboarding integration (PR #62)

| ✓ | Step | Expected |
| --- | --- | --- |
|   | Run a fresh signup all the way through the 17 onboarding steps. | Header still reads "STEP 17 OF 17" (not 18). The Iris additive doesn't pollute the counter. |
|   | On `ProfileReview`, tap "Complete & Enter App" without using Iris. | `signup_completed = true`, `completion_pct = 100`, MainNavigator shown. **No regression.** |
|   | Sign up another fresh user. On `ProfileReview`, tap "Want a hand? Talk to Iris first". | `IrisInterview` screen shown, no header (`headerShown: false`). |
|   | Tap "Start the interview" → trial CTA → run the interview to completion → "Use this bio". | `profiles.prompts.bio` populated. Banner reads "Bio saved to your profile". |
|   | Tap "Done — enter the app". | `signup_completed = true`. MainNavigator shown. |
|   | Sign up another fresh user. On `IrisInterview`, tap "Maybe later". | Returns to `ProfileReview` with the existing button row intact. |

## Privacy + analytics (PR #63)

| ✓ | Step | Expected |
| --- | --- | --- |
|   | Visit `https://chemirl.app/privacy` (or local preview). | Section 3 includes the AI sub-processor bullet naming Anthropic. |
|   | Search the page for "Iris" and "Anthropic". | Both present. Wording confirms opt-in, match-not-notified, opt-out-doesn't-cascade. |
|   | `trackEvent('iris_session_started', { surface: 'interview' })` in a temp file. | Type-checks cleanly. |
|   | Run an interview end-to-end with `__DEV__` console open. | `iris_draft_used` event appears in `[Analytics]` log when "Use this bio" is tapped. |

## Existing flows (regression check)

The Iris feature must not regress any existing path. Run each at least once after PRs 1–7 land.

| ✓ | Path |
| --- | --- |
|   | Sign up + manual onboarding + complete to MainNavigator. |
|   | Like → match → propose 2-3 windows → confirm one → chat → send a message. |
|   | Buy a token pack via existing IAP. Verify `tokens.balance` increments. (PR 3's IAP edit is additive but worth a smoke check.) |
|   | Reactivate an expired match using a token. |
|   | Edit profile from `ProfileScreen` (bio + photos + prefs save correctly, no Iris involvement). |

## Failure modes worth probing

These aren't blocking but record the result:

- Anthropic API down: iris-chat returns 502. Mobile shows generic error.
- Anthropic returns a malformed SSE chunk: client emits a `warning` event in the stream and continues.
- Trial user's clock is wrong: `iris_can_use()` is server-evaluated; client clock skew doesn't matter.
- User signs out mid-stream: next `getSession()` call from the client returns no session; `streamIrisTurn` throws `IrisError('no_session', 401)`.

## Sign-off

| Reviewer | Date | Notes |
| --- | --- | --- |
|   |     |     |

When everything above is green, Phase 1 is shippable. Open Question
items 1–6 in the design spec (`~/.claude/plans/the-whole-premise-behind-purring-blossom.md`)
need to be resolved before scaling, but they don't gate the launch.
