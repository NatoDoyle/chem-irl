# Autonomous CMO for Chem IRL — System Design & Build Plan

**Status:** DRAFT for review · **Date:** 2026-06-09 · **Owner:** Nathan Doyle
**Runtime:** OpenClaw `2026.6.1` on Hetzner VPS `OpenClaw` (188.245.123.146, Ubuntu 26.04, root)
**Related docs:** `docs/DUBLIN_LAUNCH_PLAN.md`, `brand/MESSAGES.md`, `brand/PRODUCT.md`, `WAITLIST_AUDIT.md`, `App Plans/Marketing Plan…`, `App Plans/Brand & Growth…`
**As-built / operations:** [docs/infrastructure/OPENCLAW_CMO_VPS.md](../../infrastructure/OPENCLAW_CMO_VPS.md) — the living doc for what is actually deployed on the VPS

> This spec defines a system that **runs outside this repo** (on the VPS) but **acts on this repo** (blog/newsletter via PR) and on Chem IRL's external marketing surfaces. It is intentionally phased: a north-star vision delivered as independently-useful increments. Nothing here is built until this design is approved.

> ⚠️ **§3 non-goal "Multi-tenant / productising this" superseded (2026-07-06):** the CMO is now the Chem IRL Solutions platform's per-tenant "marketing seat" (Chem IRL's VPS = seat #1; control-plane registration pending the platform's seat registry) — see [docs/SOLUTIONS_PLATFORM.md](../../SOLUTIONS_PLATFORM.md) and the platform repo's `docs/suite/TENANCY_POLICY.md`. The rest of this spec stands as a dated record.

---

## 1. Vision

A single always-on **autonomous CMO** that owns Chem IRL's marketing function end-to-end and runs the loop:

```
        ┌─────────── SENSE ───────────┐
        │  analytics + market research │
        ▼                              │
   SYNTHESISE  →  CREATE  →  APPROVE  →  DISTRIBUTE
   (insights)    (drafts)   (founder)   (publish/schedule)
        ▲                              │
        └─────────── LEARN ────────────┘
            (what performed → adjust)
```

It is your **marketing department, not a tool you operate.** You set strategy and approve; it does the research, the analytics, the writing, the posting, the newsletter, and the reporting — across the blog + X + LinkedIn + Threads + Instagram + TikTok + Reddit + email — and tells you what's working.

It is **distinct from the in-app "Iris" concierge** (the mobile assistant). Different surface, different trust boundary, different codebase. (Working name below: "the CMO". Final name TBD.)

## 2. Goals & success criteria

The CMO exists to serve Chem IRL's product north-star and Dublin GTM — not vanity metrics.

| Horizon | Goal | Measured by |
|---|---|---|
| **Mechanical** | Replace founder-manual marketing ops with supervised automation | Hours/week of founder marketing time ↓; cadence maintained without founder doing the work |
| **Funnel** | Grow confirmed Dublin waitlist on the GTM curve (200 → 1,500 → beta) without breaking gender balance | Confirmed signups/week, female %, source attribution |
| **Brand** | Every public artifact is on-voice and on-message | Voice-check pass rate; zero off-brand incidents |
| **Strategic (north-star)** | Top-of-funnel that converts to *real dates*, not engagement | Eventually: signup→confirm→(post-launch) confirmed-date attribution by channel |

**Definition of done for the *program*:** the founder's weekly marketing involvement is reduced to (a) reading one intelligence digest, (b) approving a content queue, (c) occasional strategic redirection — while reach, content cadence, and waitlist growth all increase.

## 3. Non-goals (YAGNI — explicitly out of scope for v1)

- **Paid ad campaign management** (Google/Meta ads buying). Organic + owned channels first; paid is a later layer.
- **Replacing founder strategy/judgment.** The CMO proposes; the founder disposes.
- **Real-time community management / DM support** on social platforms (inbound support is a separate function).
- **A bespoke web dashboard.** Reporting goes to Telegram + flat files first; a dashboard is only built if Telegram proves insufficient.
- **Multi-tenant / productising this.** It serves one brand: Chem IRL.

## 4. Guiding principles & guardrails

1. **Autonomy is earned, per capability, per platform.** Start read-only, graduate to draft-and-approve, graduate to scheduled-with-approval, and only then to supervised autonomy. (See §9 trust ramp.)
2. **Brand voice is law.** Every outward artifact passes a voice-check against `brand/MESSAGES.md` + `brand/PRODUCT.md` before it can enter the approval queue.
3. **One approval surface: Telegram.** The founder approves/edits/rejects from the existing (now DM-only, hardened) Telegram channel. Nothing public ships un-approved while in ramp.
4. **Reversible by default, kill-switch always.** Drafts before posts; schedule with a cancel window; a single `cmo pause` halts all autonomous activity.
5. **Least privilege + auditability.** Scoped per-platform credentials, read vs write separated where the platform allows; every action is logged with who/what/when and is queryable.
6. **Respect platform rules and the law.** Per-platform automation policy is a first-class design input (some platforms forbid browser automation). Influencer/incentive disclosure (ASAI/FTC) and GDPR (EU data) are mandatory.
7. **Cheap by default, strong when it matters.** Route bulk research/summarisation to cheaper models (GLM-5.1/MiniMax via Tensorix); route brand-critical copy to the strongest model (Claude via the bundled `claude-cli` provider).
8. **Truthful marketing.** No fabricated stats, fake testimonials, or invented user quotes. Claims trace to real product facts (`brand/PRODUCT.md`) or real data.

## 5. System architecture

### 5.1 Components

```
                          ┌──────────────────────────────────────────────┐
   Founder (Telegram) ───▶│            CMO ORCHESTRATOR                   │
   approve / direct  ◀────│   (OpenClaw agent "main", CMO system prompt) │
                          │   model routing: Claude=voice, GLM=bulk      │
                          └───────┬───────────────┬──────────────────────┘
                                  │               │
                 ┌────────────────┘               └─────────────────┐
                 ▼                                                   ▼
        ┌──────────────────┐                              ┌────────────────────┐
        │  CONNECTORS       │  uniform interface:          │  MARKETING STORE    │
        │  read_metrics()   │  ┌────────────┬───────────┐  │  (SQLite/DuckDB on  │
        │  read_mentions()  │  │ API backend│ browser   │  │  VPS; optional      │
        │  publish(draft)   │  │            │ backend   │  │  Supabase mirror)   │
        │  schedule(draft)  │  └────────────┴───────────┘  │  metrics · calendar │
        └──────┬────────────┘                              │  post_log · research│
               │                                           │  experiments        │
   ┌───────────┼───────────────────────────────────────┐  └────────────────────┘
   ▼     ▼     ▼     ▼     ▼     ▼     ▼          ▼
  Blog   X   LinkedIn Threads IG  TikTok Reddit  Resend         ┌──────────────┐
 (git/PR)(API)(browser)(API) (API)(API*) (API)  (newsletter)   │ Bronto MCP   │
                                                                │ observability│
   ▲                                                            └──────────────┘
   │ market research: web browse + search (competitors, trends, subreddits, reviews)
   │
   └─ Scheduler: systemd timers / OpenClaw tasks (daily pull, weekly digest, content cadence)
```

### 5.2 Key components

- **CMO Orchestrator** — the existing OpenClaw `main` agent, re-prompted with a CMO playbook + brand context pack. It plans, calls connectors, writes content, and talks to the founder over Telegram. Model routing per task class.
- **Brand & Strategy context pack** — a curated bundle the agent loads every task: `brand/MESSAGES.md`, `brand/PRODUCT.md`, `brand/tokens.ts` (taglines), `docs/DUBLIN_LAUNCH_PLAN.md` highlights, the two `App Plans/` docs, and a distilled **CMO playbook** (do's/don'ts, voice rubric, per-platform style). Kept in the marketing workspace and refreshed from the repo.
- **Connectors** — one module per surface exposing a uniform interface (`read_metrics`, `read_mentions`, `publish`, `schedule`). Each is implemented as **API** or **browser** backend (see §8). Exposed to the agent as **MCP tools** and/or CLI scripts so calls are logged and testable.
- **Marketing Store** — the CMO's memory/state: metrics time-series, content calendar, post log, research notes, experiment results, audience/competitor intel. **Recommendation:** start with SQLite (or DuckDB) on the VPS for simplicity; optionally mirror to a Supabase `marketing` schema later if you want SQL dashboards alongside product data.
- **Scheduler** — recurring routines (daily metrics pull, weekly intelligence digest, content cadence). **Recommendation:** systemd user timers on the VPS invoking scoped `openclaw` agent runs (the box already has linger + user systemd); DB-side jobs (newsletter lifecycle) use Supabase `pg_cron` (consistent with existing `expire-matches-hourly`).
- **Control plane (Telegram)** — founder command vocabulary + approval queue + digests. Reuses the hardened DM-only channel.
- **Observability** — Bronto MCP (8 tools) + structured action logs + the weekly digest. Every publish/schedule/spend is recorded.

### 5.3 The control loop (data flow)

1. **Sense** — connectors pull analytics + mentions; research routines browse the market → Marketing Store.
2. **Synthesise** — agent analyses deltas/opportunities → an **intelligence digest** to Telegram.
3. **Create** — agent generates content (blog/social/newsletter) in brand voice → voice-check → **approval queue**.
4. **Approve** — founder approves / edits / rejects via Telegram.
5. **Distribute** — connectors publish or schedule approved items (blog via PR, social via API/browser, email via Resend).
6. **Measure** — connectors track each shipped item's performance → Marketing Store.
7. **Learn** — agent correlates content→outcomes, proposes cadence/topic/format adjustments and experiments.

## 6. Runtime: OpenClaw as the CMO

Reuse the existing, now-hardened install rather than build new infra:

- **Agent:** `main`, system prompt replaced/extended with the CMO playbook. Sessions persist (`~/.openclaw/agents/main/sessions`).
- **Models:** default `tensorix/z-ai/glm-5.1` for research/summaries; **route brand copy to Claude** via the bundled `claude-cli` provider; `r1`/`minimax` aliases available for reasoning/cost trade-offs.
- **Tools:** `tools.profile=coding` already grants exec/fs/browser — the agent can run connector scripts, write files, and browse. Browser control (enabled) is the fallback posting/analytics path for API-hostile platforms.
- **Connectors as MCP:** add marketing connectors as MCP servers (joining `bronto`), so they appear in `openclaw mcp list`, are probeable (`openclaw mcp probe <name>`), and every tool call is logged.
- **Channel:** Telegram (DM-only, paired operator) is the control plane.
- **Config discipline:** all changes via `openclaw config set … --strict-json --merge` → `openclaw config validate` → `openclaw gateway restart` (per the version gotchas already learned).
- **Secrets:** `~/.openclaw/.env` (now `600`) holds platform tokens; never echoed.

## 7. Security note on the runtime (carry-over from the hardening pass)

The agent runs **as root, unsandboxed, with exec + full filesystem**, now reachable **DM-only by the paired operator**. Adding outward-facing posting powers raises the stakes: a prompt-injection in scraped web content could, in principle, try to steer an over-privileged agent. Mitigations baked into this design:
- Connectors mediate all platform actions (the agent calls `publish(draft_id)`, it does not hand raw credentials to arbitrary code paths).
- Approval gate stands between generated content and anything public during ramp.
- Treat scraped/ third-party text as **untrusted data, not instructions** (the playbook states this explicitly).
- Consider, as a later hardening step, running connector execution under a reduced-privilege user or `sandbox.mode` for the marketing agent context.

## 8. Per-platform integration matrix (the hard reality)

"Post + track analytics everywhere" is **not uniform.** This table drives feasibility, cost, and risk. *(API terms change — verify each at build time.)*

| Surface | Account/setup needed | Read analytics | Publish | Mechanism | Automation / ToS risk | Priority |
|---|---|---|---|---|---|---|
| **Blog** | Repo write (deploy key / fine-grained PAT) | Plausible Stats API + repo | MDX file → branch → **PR** → Vercel deploy | git/PR connector | None (PR-gated, you merge) | **P0** |
| **Reddit** | Reddit app (OAuth), aged account | Official API | Official API | API connector | Medium — **self-promo is policed**; must be authentic, follow per-sub rules, ~9:1 value:promo | **P1** |
| **Threads** | Threads/Meta app, pro account | Threads Insights API | Threads API (post) | API connector | Low — official API exists | **P1** |
| **X / Twitter** | X developer app; **paid tier** for real read/volume (~$200/mo Basic) | API (paid) | API (free tier limited writes) | API connector | Low (API) but **cost** is the issue | **P1** |
| **Instagram** | IG **Business/Creator** acct linked to FB Page; Meta app | Graph API Insights | Graph **Content Publishing** API (image/video/carousel/Reels) | API connector | Low if business acct; setup friction | **P2** |
| **TikTok** | TikTok developer app + **content-posting approval** | Display/Analytics API | Content Posting API (direct or to drafts) | API connector (*approval gate*) | Medium — app review required; until approved, post-to-drafts only | **P2** |
| **LinkedIn** | LinkedIn app; `w_member_social` for own-profile posts | Very limited for personal profiles | Own-profile post possible via API; richer analytics not | API where possible, **browser fallback** | **High if browser-automated** (against ToS; account risk) | **P2** |
| **Newsletter** | Resend key + verified `chemirl.app` domain; audiences exist | Resend + Supabase | Resend broadcasts + `pg_cron` lifecycle | Resend connector + edge fns | Low (owned channel) | **P0/P1** |

**Design consequences:**
- **API-first wherever it exists** (Blog, Reddit, Threads, X, IG, TikTok, Resend). Browser automation is the **last resort** (mainly LinkedIn) and you must explicitly accept its ToS/account risk.
- **Two setup-heavy items** gate full coverage: IG needs a Business account + Meta app; TikTok needs app approval. These run in parallel with earlier phases.
- **Cost reality:** meaningful X automation (~$200/mo) **alone equals the entire stated €200/mo pre-revenue marketing budget** (`DUBLIN_LAUNCH_PLAN.md` §budget). This is an explicit open decision (§18).

## 9. Autonomy & approval model

### 9.1 Trust ramp (per capability × platform)

| Level | Name | Behaviour |
|---|---|---|
| **L0** | Observe | Read-only. Pulls analytics, researches, reports. Cannot create or post. |
| **L1** | Draft | Generates content + schedules into a **draft queue**; founder approves each before it ships. |
| **L2** | Scheduled-with-notice | Posts on the calendar but posts a "going out in 1h" notice with a cancel window. |
| **L3** | Supervised autonomy | Posts within pre-approved guardrails (topics, cadence caps, platforms); founder reviews after the fact. |

Every surface starts at **L0** and graduates only on demonstrated reliability + founder say-so. Different surfaces can sit at different levels (e.g., blog L1 forever via PR; Reddit may stay L1 due to spam-policing; internal reporting is L3 immediately).

### 9.2 Telegram control vocabulary (illustrative)

```
cmo status                 → health, what's queued, what shipped
cmo digest                 → on-demand intelligence report
cmo queue                  → list pending drafts
cmo show <id>              → full draft + voice-check result
cmo approve <id> [@time]   → approve (optionally schedule)
cmo edit <id> "<note>"     → request a revision
cmo reject <id>            → kill a draft
cmo pause / cmo resume     → global kill-switch
cmo idea "<topic>"         → ask it to draft something specific
```

(Implemented as the agent interpreting natural commands in the DM channel — no rigid syntax required; the above is the mental model.)

## 10. Content system

### 10.1 Content types
- **Blog pillar posts** — long-form, SEO/AEO-structured to the existing schema (`primaryQuestion`, `secondaryQuestions`, `faq`, `tldr`, `citableClaim`, `entities`, `category` ∈ behind/advice/takes). The blog is the **compounding asset** and the source-of-truth content node.
- **Repurposing** — each blog post → an X thread, a LinkedIn post, a Threads post, a carousel/Reel concept (IG/TikTok), a Reddit-appropriate contribution. One idea, many native formats.
- **Native social** — platform-first posts not derived from blog (trend reactions, polls, behind-the-build).
- **Newsletter** — (a) lifecycle drip (D0/D7/D14 + beta-invite, currently unbuilt) and (b) broadcast-on-publish + periodic roundups, via Resend audiences (waitlist, blog).

### 10.2 Brand-voice enforcement
A **voice-check** step (a model pass with the `MESSAGES.md` rubric) gates every artifact: imperative over expressive, name-friction-then-fix, specificity (numbers/timestamps), one-sentence bias, and the explicit "what we don't write" list (no hedging, no engagement bait, no hollow praise). Fails are auto-revised before queueing.

### 10.3 Editorial calendar & cadence
- Cadence aligns to the **GTM phase** (Dublin density-first; ICPs women 22–32 / men 24–34; channels TikTok/IG/Reddit/LinkedIn). Pre-launch tilts to awareness + waitlist; later tilts to activation.
- The calendar lives in the Marketing Store and is the contract the scheduler executes.
- **Gender-balance awareness:** content/targeting respects the GTM rule of pulling **women ahead of pace** — the CMO flags when reach/signup skews male.

### 10.4 SEO / AEO
Leverage the already-rich blog schema: the CMO researches the `primaryQuestion` space (what people ask, what competitors rank for, what AI assistants cite), writes `citableClaim`s designed to be quoted, and maintains internal linking + `entities`. This is a standing Sense→Create workflow, not a one-off.

## 11. Measurement, KPIs & attribution

### 11.1 Per-surface metrics (pulled into the Store)
- **Blog/site:** Plausible (sessions, sources, top posts, conversions), search/AEO visibility.
- **Social:** impressions, engagement rate, follower delta, top posts, saves/shares, profile→link clicks.
- **Newsletter:** sent/open/click, list growth, confirm rate.
- **Waitlist (the money metric pre-launch):** confirmed signups, gender split, top referrers, % confirmed — from `db/waitlist_ops_queries.sql`.

### 11.2 North-star linkage
Roll up to the product north-star (`brand/PRODUCT.md`: confirmed dates/WAU ≥ 0.15, median TTD ≤ 7d) and GTM phase gates. Marketing's pre-launch proxy = **confirmed Dublin waitlist on-curve with healthy gender balance**.

### 11.3 Attribution (prerequisite work — the P0 gap)
`WAITLIST_AUDIT.md` flags **UTM capture is entirely missing** (P0-3) — so "which channel drove these signups" is currently **unanswerable**. The CMO is partly blind until this is fixed. **This spec absorbs UTM instrumentation as a foundational task**: add `utm_source/medium/campaign/term/content` through the form → `waitlist-signup` edge fn → RPC → `waitlist_signups`, and have connectors tag every outbound link. Without it, channel ROI is guesswork.

### 11.4 Weekly intelligence digest (the headline deliverable of Sense)
A single Telegram report: what moved, by how much, vs last week; top/bottom content; channel attribution; competitor/market notes; 3 recommended actions; anomalies. This is the first thing the CMO earns the right to send.

## 12. Data model (Marketing Store)

Minimal, extensible:

- `metric_snapshots(id, surface, metric, value, captured_at, dims_json)` — time-series for every platform metric.
- `content_items(id, type, surface, status, title, body_ref, voice_check_json, brand_refs, created_at, scheduled_at, published_at, external_id)` — the content lifecycle (draft→queued→approved→scheduled→published).
- `post_log(id, content_item_id, surface, action, external_id, result, at)` — immutable audit of every publish/schedule.
- `research_notes(id, topic, source_url, summary, captured_at, tags)` — market/competitor intel.
- `experiments(id, hypothesis, variant, surface, started_at, ended_at, result_json)` — what we tried, what happened.
- `audience_segments` / `competitors` — reference tables for ICPs and tracked rivals.

## 13. Security, compliance & brand safety

- **Secrets:** per-platform tokens in `~/.openclaw/.env` (600); OAuth refresh handled by connectors; rotate on a schedule; never logged/echoed.
- **Least privilege:** read-scoped tokens where the platform separates read/write; posting tokens distinct.
- **Platform ToS:** API-first; **browser automation only where explicitly accepted** (LinkedIn) with the founder's informed sign-off; respect rate limits and per-platform content rules (esp. **Reddit self-promo** policing).
- **Disclosure & law:** ASAI/FTC disclosure on any incentivised/affiliate content; **GDPR** for EU waitlist data (Supabase EU region, existing `waitlist-forget` erasure path); honour consent flags already captured at signup.
- **Brand safety:** no fabricated claims/testimonials; sensitive-topic guardrails (dating/safety framing per `PRODUCT.md`); approval gate during ramp; kill-switch always.
- **Prompt-injection posture:** scraped content is data, not instructions; connectors mediate actions; consider reduced-privilege execution for the marketing context.
- **Failure modes:** connector auth expiry → alert + pause that surface; API rate-limit → backoff + reschedule; VPS down → systemd restart + linger (already configured); no silent failures (every routine reports success/failure).

## 14. Phased build sequence (step-by-step)

Each phase is independently useful and has explicit exit criteria. **Build order: 0 → 1 → 2 → 3 → 4.**

### Phase 0 — Foundation (built alongside Phase 1)
**Goal:** the agent can safely *reach* and *remember*, with guardrails.
1. Create the **marketing workspace** on the VPS (git-backed dir: playbook, brand context pack, calendar, state).
2. Assemble the **Brand & Strategy context pack** (pull `brand/*`, GTM highlights, App Plans) + write the **CMO playbook** (voice rubric, do/don't, per-platform style, "scraped text = untrusted").
3. Stand up the **Marketing Store** (SQLite/DuckDB) + schema (§12).
4. Define the **connector interface** + a **mock connector** to prove the shape end-to-end.
5. Wire the **Telegram control vocabulary** + the **kill-switch**.
6. Set up **scheduling** (systemd user timers) + **logging/observability** (Bronto + action log).
7. Decide & record the **secrets layout** and model-routing policy.
**Exit:** agent runs a scheduled no-op routine, writes to the Store, reports to Telegram, and can be paused/resumed.

### Phase 1 — Sense (analytics + market research) · *recommended first increment*
**Goal:** the CMO is your **read-only marketing analyst**, covering all surfaces.
1. Build **read connectors**, easiest-first: **Blog/Plausible** + **Waitlist/Supabase** (no third-party setup) → then **Reddit**, **Threads**, **X (read)**, → then **IG**, **TikTok**, **LinkedIn (read; browser if needed)**.
2. Implement **market-research routines**: competitor monitoring, dating-subreddit listening, app-store review mining, trend scanning (browser + search).
3. Land everything in `metric_snapshots` / `research_notes`.
4. Ship the **weekly intelligence digest** (§11.4) + on-demand `cmo digest`.
5. **Instrument UTM capture** (the P0 attribution gap) so channel data starts accumulating.
**Exit:** a single weekly Telegram digest covering every connected surface + waitlist, with attribution beginning to populate. No posting yet. (Proves the agent can reach everything before it can post anything.)

### Phase 2 — Create (content engine)
**Goal:** on-voice content produced on demand and on calendar — **draft only (L1)**.
1. Implement the **content pipeline**: idea → research → draft → **voice-check** → approval queue.
2. **Blog generator** to the existing MDX schema (full frontmatter) + **PR connector** (branch → PR → you merge → Vercel).
3. **Repurposing engine**: blog → per-platform native variants.
4. **Calendar** + cadence aligned to GTM phase.
5. Telegram **approval UX** (`queue`/`show`/`approve`/`edit`/`reject`).
**Exit:** founder receives a steady queue of on-brand drafts (blog + social + newsletter) and ships them with one tap; nothing posts without approval.

### Phase 3 — Distribute (publishing + newsletter)
**Goal:** approved content actually goes out — **scheduled, L1→L2**.
1. **Write connectors** per platform (API-first; LinkedIn browser only if accepted): Reddit, Threads, X → IG, TikTok → LinkedIn.
2. **Newsletter:** implement the planned **lifecycle drip** (D0/D7/D14 + beta-invite) via `pg_cron` + Resend, and **broadcast-on-publish**; fix the `RESEND_API_KEY`/audiences setup flagged in `WAITLIST_AUDIT.md`.
3. **Scheduling + cancel window**; **post_log** every action.
4. Per-platform **rate-limit & retry**; **failure alerts**.
**Exit:** approved items publish on schedule across connected platforms; the newsletter runs itself; every send is logged + measured.

### Phase 4 — Learn (closed loop + autonomy ramp)
**Goal:** the CMO improves itself and earns autonomy.
1. **Content→outcome correlation** (which topics/formats/times perform) feeding back into Create.
2. **Experimentation** framework (hypotheses, variants, readouts).
3. **Autonomy ramp** to **L2/L3** on surfaces that have proven reliable, within guardrails (topic/cadence caps).
4. **Strategy proposals**: the CMO recommends shifts (channel mix, cadence, gender-balance corrections) in the weekly digest.
**Exit:** founder involvement = read digest + approve queue + occasional redirection; reach/cadence/waitlist all trend up.

## 15. Roadmap / timeline (mapped to the Dublin GTM)

Indicative; tune to your capacity. (GTM weeks per `DUBLIN_LAUNCH_PLAN.md`.)

| When | CMO milestone | GTM context |
|---|---|---|
| **Wk 1–2** | Phase 0 + Phase 1 read connectors (Blog/Plausible, Waitlist) + first digest | Building waitlist system / cold-start prep |
| **Wk 3–4** | Phase 1 social read connectors + market research + **UTM live** | Channel experiments begin to be measurable |
| **Wk 4–6** | Phase 2 content engine (blog + repurposing, L1 drafts) | Feed cold-start (200 signups) with on-brand content |
| **Wk 6–9** | Phase 3 publishing (Reddit/Threads/X) + newsletter lifecycle | Referral compounding phase needs consistent output |
| **Wk 9–12** | Phase 3 IG/TikTok/LinkedIn + Phase 4 learn loop | Scale toward 1,500 signups, watch gender balance |
| **Ongoing** | Autonomy ramp per surface | Soft-launch → public Dublin launch |

## 16. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Brand-voice drift** in public posts | Med | High | Voice-check gate + L1 approval until proven; strong model for copy |
| **Account ban** from browser-automating LinkedIn/IG | Med | High | API-first; browser only with explicit sign-off; conservative rates; treat as optional |
| **X API cost** blows the budget | High | Med | Decide tier explicitly (§18); start with free-tier read-lite or defer X |
| **Hallucinated facts/claims** | Med | High | Claims trace to `PRODUCT.md`/real data; voice-check forbids fabrication |
| **Over-posting / spammy** (esp. Reddit) | Med | High | Cadence caps; Reddit stays L1; value:promo ratio enforced in playbook |
| **Prompt injection** via scraped content steering a root agent | Low | High | Data≠instructions; connector-mediated actions; consider reduced-privilege exec |
| **Secret leakage** | Low | High | 600 perms (done), no echo, rotation, least-privilege tokens |
| **Single VPS failure** | Low | Med | systemd restart + linger (done); Store backups; state in git where possible |
| **Attribution blindness** (no UTM) | High (today) | High | UTM instrumentation is a Phase-1 foundational task |

## 17. Cost (rough, monthly)

| Item | Est. | Notes |
|---|---|---|
| VPS (Hetzner) | already paid | running |
| Tensorix inference | variable | bulk on cheap models; Claude only for copy |
| Resend | €0 | free ≤3k emails/mo (fits now) |
| Reddit / Threads / IG / TikTok APIs | €0 | within free tiers (TikTok needs approval, not money) |
| **X API (Basic)** | **~$200/mo** | the budget-breaker — explicit decision |
| Browser-automation infra (proxies, if any) | optional | only if LinkedIn browser path chosen |

**Headline:** everything except X fits a near-zero budget. X is the one real spend, and it's the size of the whole stated pre-revenue marketing budget — so it's a deliberate choice, not a default.

## 18. Open decisions (recommended defaults in **bold**)

> **Resolved 2026-06-09 (founder said "continue"): the recommended defaults are ADOPTED**, pending any correction — ① Phase 0+1 first; ② defer paid X; ③ start IG Business/Creator + TikTok app review in parallel now; ④ LinkedIn API-only, no browser automation; ⑤ SQLite store; ⑥ PR-gated blog; ⑦ scoped GitHub PAT for the blog connector; ⑧ first increment = Phase 0 + Phase 1.

1. **Autonomy to start:** **L0→L1 (read-only, then draft-and-approve)** everywhere; ramp later. ▸ alt: jump to L2 scheduled.
2. **X API:** **defer paid X to Phase 3 and decide then** (read-lite or skip until revenue) vs pay ~$200/mo now.
3. **Instagram/TikTok:** **convert to Business/Creator + start TikTok app approval in parallel during Phase 1** (long lead time) vs defer to Phase 3.
4. **LinkedIn:** **API own-profile posting only; no browser automation** vs accept browser automation (account risk) for richer posting/analytics.
5. **Marketing Store:** **SQLite/DuckDB on the VPS** vs Supabase `marketing` schema (SQL dashboards, shared with product data).
6. **Blog publishing:** **always PR-gated (you merge)** — recommended permanently vs eventual auto-merge for low-risk posts.
7. **Repo access for the agent:** **fine-grained PAT / deploy key scoped to PRs** vs broader access.
8. **First increment:** **Phase 0+1 (Foundation + Sense)** — recommended vs start at Create.
9. **CMO name** (cosmetic): TBD (not "Iris").

## 19. Immediate next steps

1. **You review this spec** and settle §18 (especially: autonomy start level, X spend, IG/TikTok account setup, LinkedIn stance, Store choice).
2. On approval, I invoke the **writing-plans** skill to produce a detailed implementation plan for **Phase 0 + Phase 1** (the only thing we build first).
3. In parallel (long lead-time, founder-side): convert IG to Business/Creator, create the Meta/Threads app, start the TikTok content-posting app review, create the Reddit + X developer apps, mint a scoped GitHub PAT for the blog connector. (I can produce a checklist for each.)
4. Confirm `RESEND_API_KEY` + audiences are set (the `WAITLIST_AUDIT.md` P0) so the newsletter path isn't silently broken.

---

*End of design. This is a living document; revise in `feat/autonomous-cmo-spec` until approved, then it becomes the contract the implementation plan is written against.*
