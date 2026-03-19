# Monetization Strategy: "Free to Be Serious"

> **Status**: Reference document — not yet implemented
>
> **Core principle**: Your reputation is earned through behavior. Your second chances are bought with money. These two systems never cross.

## Philosophy

Chem IRL's core value prop is reduced time-to-date. The 72-hour proposal expiry and scoring system already punish slowness behaviorally. The monetization model extends this: **the app is free when you show up; you only pay when you don't.**

Paying must never buy better matches, higher visibility, or algorithmic advantage. Money buys second chances and convenience — never advantage.

---

## Pillar 1: Seriousness Bonds (Per-Match Deposit)

Each match costs 1 bond from each user. Bonds are returned when you follow through. Forfeited when you don't. Serious users recycle bonds forever and never pay.

### Mechanics

- Users start with **5 free bonds**
- **3 bonds replenish per week** (cap at 5)
- 1 bond consumed per user when a match is created

#### Bond return conditions

A bond is **returned** when:

| Condition | Whose bond |
|-----------|-----------|
| You send a proposal within 72h | Sender's bond |
| You respond to a proposal within 72h | Receiver's bond |
| You attend the date | Both bonds (if not already returned) |

#### Bond forfeit conditions

A bond is **forfeited** when:

| Condition | Whose bond |
|-----------|-----------|
| Match goes stale — 72h with no proposal from you | Your bond |
| You let a proposal expire without responding | Your bond |
| You no-show a date | Your bond |

When out of bonds, the user cannot make new matches until weekly replenishment or purchase.

### Pricing

| Pack | Price | Per-Bond |
|------|-------|----------|
| 3 bonds | $3 | $1.00 |
| 7 bonds | $6 | $0.86 |
| 15 bonds | $10 | $0.67 |

### Schema reference

The `purchase_type` enum already includes `'bond'` (see `db/schema.sql`).

---

## Pillar 2: Second Chance Credits (A La Carte)

Credits undo mechanical consequences (dead match, expired proposal). They **never** undo behavioral consequences — score drops always stick.

### Credit actions

| Action | Cost | Who pays | Rationale |
|--------|------|----------|-----------|
| **Reopen expired proposal** | 2 credits | Receiver | Sender did the work; receiver was slow. Receiver proposes their own times. |
| **Revive stale match** | 2 credits | Inactive party | You let 72h pass without proposing. Pay for a second shot. |
| **Undo a pass** | 1 credit | The swiper | Correct your own mistake. Other person still has to like you back. |
| **Reschedule after late cancel** | 1 credit | The canceller | Cancelled <24h before a date. Pay to send new proposal. Reliability score still takes the -5 hit. |

### What credits don't buy

- Feed position boosts (no "super likes", no "boosts")
- See who liked you before matching
- More daily likes/swipes
- Algorithm manipulation of any kind
- Score recovery — only behavior over time fixes your score

### Pricing

| Pack | Price | Per-Credit |
|------|-------|------------|
| 5 credits | $5 | $1.00 |
| 15 credits | $12 | $0.80 |
| 30 credits | $20 | $0.67 |

### Schema reference

The `credit_feature` enum (`db/schema.sql`) currently has: `'reopen'`, `'fast_pass'`, `'extra_chat'`, `'stack_pass'`. New enums to add alongside existing: `'revive'`, `'undo_pass'`, `'reschedule'`. The existing `'reopen'` value already maps to the "reopen expired proposal" action. The `purchase_type` enum already includes `'credits'`.

---

## Pillar 3: Serious Dater's Toolkit (Subscription, ~$8–12/mo)

Tools that help serious daters find other serious daters, optimize their profile, and make better decisions. Not vanity metrics.

### Feature breakdown

| Feature | What it does | Pay-to-win? |
|---------|-------------|-------------|
| **Seriousness signals in feed** | `action_speed` tier labels on profiles ("Fast mover", "Steady", etc.) — identify time-wasters before swiping | No — doesn't change ranking or visibility |
| **Proposal read receipts** | Know when they opened your proposal + countdown to expiry | No — transparency, not advantage |
| **Advanced preference filters** | Filter YOUR feed by preferred date types, response-speed tier | No — filters your view, doesn't change your visibility |
| **Photo & profile analytics** | Which photo gets most likes, impression-to-like trends over time | No — self-improvement tool |
| **Score dashboard** | Your three scores over time with trend arrows, weekly digest | No — your own data |
| **Monthly credit drip** | 3 free credits/month included | No — same credits anyone can buy |
| **Date safety check-in** | Share date plans with trusted contact, automated check-in text | No — safety feature |

**Seriousness signals are subscriber-exclusive.** Free users still benefit from the scoring system ranking their feed — they just don't see the tier labels. This is the primary subscription driver.

### Score dashboard detail

The three scores surfaced on the dashboard correspond to the scoring dimensions in `scores_daily`:

- **Action Speed** (0–100, base 50) — how quickly you propose and respond
- **Profile Quality / Attractiveness** (0–100, base 50) — Bayesian like-rate model (column: `profile_quality` in `scores_daily`)
- **Reliability** (20–100, base 70) — showing up when you say you will

### Schema reference

The `purchase_type` enum already includes `'subscription'`.

---

## What We Explicitly Don't Sell

1. **No feed boosts** — the composite score formula is the **only** ranking factor:
   ```
   composite_score = 0.60 * action_speed + 0.30 * profile_quality + 0.10 * reliability
   ```
   (See `db/rls.sql` and `supabase/migrations/20260319000001_scoring_v2_events.sql`)
2. **No "see who liked you"** — everyone discovers matches the same way
3. **No increased swipe limits** — same for free and paying users
4. **No priority placement** — no paid visibility boost
5. **No messaging advantages** — no "super likes", no highlighted profiles
6. **No score manipulation** — money never changes behavioral scores

---

## Revenue Model Summary

| Pillar | Type | Target user | Revenue driver |
|--------|------|-------------|----------------|
| Bonds | Transactional | Flaky users who run out of match slots | Volume of unserious users |
| Credits | Transactional | Anyone who makes a mistake or was slow | Frequency of expired/stale/missed interactions |
| Toolkit | Subscription | Serious daters who want efficiency + insight | Monthly recurring; credit drip improves retention |

**Key insight**: Serious users may subscribe but rarely buy bonds/credits. Flaky users buy bonds/credits but probably don't subscribe. Revenue comes from both ends of the seriousness spectrum for different reasons.

---

## Existing Schema Elements

For implementation reference, the relevant enums and tables already in place:

| Element | Location | Current values |
|---------|----------|---------------|
| `purchase_type` enum | `db/schema.sql` | `'credits'`, `'subscription'`, `'bond'` |
| `credit_feature` enum | `db/schema.sql` | `'reopen'`, `'fast_pass'`, `'extra_chat'`, `'stack_pass'` |
| Composite score weights | `db/rls.sql`, scoring v2 migration | `action_speed` × 0.60, `profile_quality` × 0.30, `reliability` × 0.10 |
| Proposal expiry | `db/automation.sql` | 72h TTL via `expires_at`, enforced by `expire_proposals()` cron |
| Stale match detection | `db/automation.sql` | 72h window via `emit_stale_match_events()` cron |

### Enums to add at implementation time

Add to `credit_feature`: `'revive'`, `'undo_pass'`, `'reschedule'`

The existing `'reopen'` enum value maps directly to the "Reopen expired proposal" credit action — no new enum needed for that action.
