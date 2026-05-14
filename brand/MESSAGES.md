# Chem IRL — Voice & user-facing copy

How we talk to users, and where the actual strings live.

## Voice

Chem IRL's product voice flows directly from [`PRODUCT.md`](./PRODUCT.md).
Two virtues — **honesty** and **action** — shape every line of copy.

### Principles

1. **Tell people what to do, not how to feel.** "Pick 2–3 times" beats
   "Excited to meet someone? Try proposing some times!" Imperative > expressive.
2. **Name the friction, then remove it.** When something failed or expired,
   say so plainly, then show the one button that fixes it.
3. **No celebration without follow-through.** A match isn't an achievement.
   The date is. Reserve celebration moments for the milestones that earned them.
4. **Numbers and timestamps are content.** "72h to respond" outperforms "soon"
   every time. Specificity is the product.
5. **One sentence whenever possible.** If a string needs two sentences, ask
   whether the second is really a decision the user needs to make.

### What we don't write

- No "fun" hedging — "Oops!", "Yikes!", "Whoops a daisy" are out.
- No engagement bait — "Don't miss out!", "Hurry, ends soon!", "X people
  liked you" are anti-product.
- No condescending praise — "Way to go!", "You're doing great!" — for
  routine actions.
- No vague reassurance — "We're on it!", "Hang tight!" without a timeline.

## Where the strings live

User-facing strings used in product flows are checked into
[`tokens.ts`](./tokens.ts) as `MESSAGES_TOKENS`. The generator emits them
into both apps as `BRAND_MESSAGES`:

- `mobile/src/config/brand.ts` (`export const BRAND_MESSAGES`)
- `web/src/config/brand.ts` (`export const BRAND_MESSAGES`)

Consumers import from the per-app `brand.ts`, not from `brand/tokens.ts`
directly. Both apps see byte-identical copy because the same source emits both.

### Current shape

```ts
BRAND_MESSAGES = {
  proposal: {
    error: '...',            // user picked invalid times
    busy: '...',             // daily proposal limit hit
    expired: '...',          // proposal aged out (72h)
    expiredReceiver: '...',  // the receiver's side of the expiry
    reminder: '...',         // nudge to act on a stale proposal
  },
  speed: {
    dormant: '...',          // user dropped out of discovery for inactivity
  },
  report: {
    receipt: '...',          // confirmation after submitting a report
  },
}
```

## Adding a new string

1. **Decide whether it's a brand message.** A brand message is reused copy
   that appears in user flows and deserves consistency across mobile/web.
   One-off labels in a single screen don't need to go here — they live
   inline in the screen.
2. **Group by surface, not by feature.** `proposal.*`, `speed.*`,
   `report.*` are user-visible concepts. New strings nest under the
   matching concept or add a new one.
3. **Edit [`tokens.ts`](./tokens.ts)** — update `MESSAGES_TOKENS`.
4. **Run `bun run brand:tokens`** to regenerate both app files.
5. **Commit the canonical edit and the generated diff together** so
   reviewers see one source change and two mechanical mirrors.

## Length and style budgets

| Surface | Max length | Notes |
|---|---|---|
| Toast / inline error | ~70 chars | One short sentence. No exclamation marks. |
| Empty-state body | ~120 chars | One sentence describing the state + one verb the user can take. |
| Modal body | ~200 chars | Two short sentences max. CTA does the work. |
| Push notification body | ~90 chars | Lead with the actor and the action. "Sam picked a time" beats "You have a new event." |

When something has to be longer than the budget, the right fix is usually
to split it into a label + body + CTA, not to keep writing.

## Tagline, description, and other top-level copy

The product tagline and one-line description live in `BRAND` in
[`tokens.ts`](./tokens.ts) and are emitted into both apps and into web
`<meta>` tags via `web/src/app/layout.tsx`.

- **Tagline** — `Spend less time texting. Test chemistry IRL.`
- **Description** — `Chemistry and vibe aren't on a screen. Meet face to face.`

Change these only when the positioning in [`PRODUCT.md`](./PRODUCT.md)
changes. They're load-bearing for SEO and store listings.
