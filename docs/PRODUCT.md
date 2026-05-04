# Chem IRL — Product Definition

> This document is the source of truth for what Chem IRL is, what it isn't, and who it's for.
> Read this before scoping or implementing any feature. If a feature can't be justified against this doc, it doesn't ship.

---

## The one-line version

**Chem IRL gets two interested people from "matched" to "sitting across from each other" in as few days as possible.**

That is the whole product. Everything else is in service of that.

---

## The ethos

Two virtues:

1. **Honesty about what you want.** Hookup, marriage, FWB, situationship, exclusive, open — say it, mean it, match on it.
2. **Action.** Propose the meet. Show up. Follow through.

We don't care *what* you want. We care that you know it, you say it, and you act on it. Match honest people who take action with other honest people who take action. The rest sorts itself out.

## The problem we're solving

Dating apps are optimized for engagement, not outcomes. They make money when you stay in the app — swiping, messaging, scrolling — not when you actually meet someone. The result is a generation of people who have hundreds of matches and zero dates, who treat the apps like a social media feed, and who have forgotten what it feels like to ask someone out.

The bottleneck isn't supply. It's honesty, friction, and flake.

## What we do

1. **Measure honesty + action, not just attractiveness.** Every user has a Seriousness Score (Elo-style) derived from behavioral signals: response latency, willingness to propose dates, follow-through on plans, profile effort, activity consistency, and consistency between stated intent and behavior. Visibility on the platform is earned by behavior, not bought.
2. **Segment users by readiness — internally only.** Three internal tiers — Ready Now, Warming Up, Window Shopping — drive matching. **These tiers are never surfaced to users.** No labels, no levels, no "you're a tier 3." Users see a feed; the system decides what's in it.
3. **Push toward the date.** Conversations have expiration windows. The UI surfaces "propose a time" early. Calendar integration and venue suggestions remove friction from the actual ask. Post-date feedback closes the loop.
4. **Penalize flaking algorithmically.** Flaking has consequences — reduced visibility, slower match flow, seriousness score impact. All invisible to the user. No public-facing badges, ratings, or reputation indicators.
5. **Embrace AI as a friction-removal layer.** AI-written openers, AI-suggested profile bios, AI date suggestions — all welcome. People will use AI either way; we'd rather build it in well than pretend it isn't happening. **Authenticity isn't a phone game; it happens in person.** The job of the app is to get you to the table. The job of being yourself is yours.
6. **Gate monetization behind behavior, not just payment.** Premium features and visibility boosts unlock against seriousness thresholds. Money alone cannot game the algorithm — we don't sell visibility to dishonest or inactive users because it ruins matches for everyone.

## What we don't do

- **We don't optimize the free tier for time-in-app.** Long sessions on the free tier are a failure signal of the product's core promise. (Paid-tier indulgences — see below — are a separate product.)
- **We don't reward dishonesty.** Mismatch between stated intent and behavior is one of the strongest negative signals in the algorithm.
- **We don't show users their score, tier, or any reputation indicator.** Behavior is measured silently. Visible scoring corrupts behavior.
- **We don't use social proof or public badges.** No "shows up" indicators, no star ratings, no verification trophies for behavior. All scoring stays internal.
- **We don't sell raw visibility.** No "boost your profile to the top for $5" untethered from behavior. Boosts must be paired with action.
- **We don't allow under-18.** Hard requirement. The only demographic restriction.
- **We don't market with internal jargon.** Internally we say "Seriousness Score" and "time-to-date." Externally we say "stop talking, start meeting." Keep the vocabularies separate.

## Paid-tier indulgences

Some users want to browse, swipe endlessly, and keep a fat inbox. We don't shame this — but we don't subsidize it either. We monetize it.

- **Infinite swipe** — paid feature.
- **Bottomless inbox** — paid feature.
- **Other low-intent browsing behaviors** — generally paid.

The free experience is action-shaped. The paid experience is more permissive. This is how we monetize the behaviors we deliberately don't optimize for, without polluting the core product.

Note: paid-tier indulgences still respect the seriousness algorithm. Paying does not buy you visibility you haven't earned. Paying buys you *more rope* — the algorithm still decides who sees you.

## Who this is for

**Anyone 18+ who knows what they want, is honest about it, and takes action.**

That's the entire filter. Not relationship type. Not age beyond legal. Not lifestyle. Three traits:

1. They know what they want from dating right now.
2. They're willing to say it honestly — in their profile, in their conversations, in their behavior.
3. They take action — propose meets, show up, follow through.

Hookups, dating, casual, serious, exclusive, open — all fine. **The product is intent-agnostic.** It doesn't care about the destination, it cares about how you travel.

## Who this isn't for

- **Anyone under 18.** Hard requirement, no exceptions.
- **People who lie about what they want.** Mismatch between stated intent and behavior is the worst signal in our system.
- **Chronic flakers.** Same mechanism — no public shaming, just algorithmic consequences and reduced visibility.
- **People who treat dating apps as pure social media on the free tier.** They naturally settle to low visibility through the algorithm. (If they want to keep browsing, they can pay — see indulgences.)

## Guiding principles for product decisions

When deciding whether to ship something, ask in this order:

1. **Does it shorten time-from-match-to-date?** If yes, lean toward shipping. If no, the bar is higher.
2. **Does it reward honesty and action?**
3. **Does it create a real-world commitment?** Calendar holds, venue picks, mutual confirmations — these are the most valuable interactions in the app.
4. **Does it surface internal scoring, tiering, or behavioral judgment to users?** If yes, redesign or kill it. Internal mechanics stay internal.
5. **Does it work just as well for someone seeking a hookup as someone seeking a long-term relationship?** It should — the app is intent-agnostic.
6. **Does it pull free-tier users deeper into the app, or push them out into the world?** Free tier should push out. Paid tier may permit the opposite.

## Behavioral design levers we use

These are the tools, not the goals. Use them deliberately:

- **Variable-ratio reinforcement** — for match discovery.
- **Loss aversion** — expiring conversations, fading visibility for inactive users.
- **Commitment escalation** — small asks early (availability) build into bigger ones (proposing a venue).
- **Endowment effect** — once a date is on the calendar, the cost of canceling feels real.
- **Fresh start mechanics** — seriousness scores recover, but the floor is set by recent behavior.

We deliberately do **not** use:
- Public social proof (badges, ratings, reputation labels)
- Visible scoring of any kind
- Streaks, levels, or any explicit gamification surface

All behavioral measurement is internal. The user experiences a feed that feels good, not a leaderboard.

## North Star metric

**Median days from match to first completed date**, segmented by internal seriousness tier.

Secondary metrics: completed-date rate per match, week-2 retention of users who completed a date, flake rate by tier, intent-vs-behavior consistency rate.

We do **not** track DAU, session length, or messages-sent as success metrics on the free tier. Those are diagnostic at best and misleading at worst.

(On the paid tier, time-in-app is a legitimate engagement signal — users are paying for that experience.)

## Out of scope (for now)

- International expansion
- Group dating / friend-matching
- Long-distance matching
- Video-first profiles
- Marketplace / events / paid social features

These may come back. They are not on the table for v1.

---

## How to use this doc with Claude Code

When prompting Claude Code on a feature, reference this file:

> "Read PRODUCT.md and DESIGN.md before suggesting an implementation. The feature must align with the principles in PRODUCT.md — flag any conflict before writing code."

If a feature request from me contradicts something here, **push back**. This doc is the contract.
