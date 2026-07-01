# OpenClaw CSO — Alex's Sales Pipeline

**Type:** Living ops doc · **Last verified:** 2026-07-01 · **Owner:** Nathan Doyle
**Host:** Hetzner VPS `OpenClaw` · `188.245.123.146` · access: `ssh openclaw` (same box as the CMO)

> Sibling to [OPENCLAW_CMO_VPS.md](OPENCLAW_CMO_VPS.md). Same box, same agent ("Alex"), same OpenClaw +
> Bronto stack — this doc covers Alex's **second seat: the autonomous LinkedIn sales pipeline**
> (`/root/marketing/cso/`). State sections reflect the Last-verified date.

Alex is now **CMO + CSO**. Beyond running marketing, it sources partner/founder leads on LinkedIn,
qualifies them, drafts personalized outreach, and (when armed) sends it — **fully automated, no approval
step**, on a ~€0 budget. It reuses the CMO's entire stack: the same Python venv, `.env`, Telegram, and
Bronto. The [CMO doc](OPENCLAW_CMO_VPS.md) owns the box, host, security, and marketing systems; this doc
is the sales half.

---

## 1. At a glance

| Component | State (2026-07-01) | Detail |
|---|---|---|
| `cso` package | ✅ LIVE | `/root/marketing/cso/` (sibling to `cmo/`); reuses venv / `.env` / Bronto / cost |
| Pipeline | ✅ Automated | source → qualify → draft → send; **no approval** (the qualify gate decides) |
| Database | ✅ `data/cso.db` | SQLite CRM: `lead` / `message` / `event` |
| Bronto service | ✅ `chem-irl-cso` | every step ships an event (reuses `cmo/obs.py`) |
| Sourcing | ✅ 3 connectors | `osm` (free Dublin venues) · `seed` (your LinkedIn URLs) · `apollo` (key-gated) |
| Qualifier / drafter | ✅ LIVE | Tensorix glm-5.1 → fit/intent/decision; in-voice DM; heuristic/template fallbacks |
| Send adapter | ⏸ **DRY-RUN** | in-house automated sender; records what it *would* send; **live transport is a stub the founder arms** |
| Timers | ✅ 3 ENABLED | `cso-source` 09:00 · `cso-pipeline` 09:25 · `cso-send` 10:00 UTC |
| Tests | ✅ | 12 cso tests (93 total across cmo + cso) |
| Kill-switch | ✅ | `CSO_PAUSED` (+ global `PAUSED`) |

**Verdict:** the loop runs itself end-to-end (verified: OSM → 5 real Dublin venues → 2 pursued / 3
nurtured → in-voice drafts → dry-run send). The one thing not live is the actual LinkedIn *send* — it
stays dry-run until the founder arms it with their own session + proxy (§5).

## 2. What it does & why

Alex's sales job is partnership + founder outreach for the Dublin launch: date-night **venues**,
**founders/investors** (cross-promo, network), and **apps/creators/press** (cross-promotion, PR). It is
**LinkedIn-only — never email**. Design principle: with a scarce ~20 personalized touches a day, the win
is qualifying hard so every touch lands on a real fit — and the **qualify gate (an LLM, not a human)**
makes that call. A public product walkthrough lives at the
[Stacktree demo](https://stacktr.ee/p/qN35TPyWHqn6tWw55eH4PT/) (sample data — *this* doc is the as-built
reality).

## 3. The pipeline (source → qualify → draft → send)

Fully automated, no approval (`sourced → qualified → ready → sent`):

1. **Source** — `cso/run_source.py` runs every connector (§4) → `pipeline.ingest` (**idempotent**: known leads are skipped, never re-sourced or re-sent).
2. **Qualify** — `cso/qualify.py`: one Tensorix call → `{fit, intent, score, decision, angle}` with a heuristic fallback. Only `decision == "pursue"` proceeds; `nurture`/`drop` leads park. **This gate replaces human approval.**
3. **Draft** — `cso/personalize.py`: an in-voice DM (direct, specific, no hype/emojis), grounded in the why-now; always returns a draft (template fallback — glm-5.1 reasoning can empty a small `max_tokens`).
4. **Send** — `cso/run_send.py` via the send adapter (§5): dry-run by default.

Every transition writes a `cso.db` event and ships a `chem-irl-cso` Bronto event. LLM spend (~$0.004/lead) is tracked via `cmo/cost.py`.

## 4. Sourcing connectors (`cso/connectors/`)

| Connector | Cost | What | Notes |
|---|---|---|---|
| `osm` | **free** | OpenStreetMap / Overpass → central-Dublin venues (bar/pub/restaurant/café/nightclub) | **Must send a `User-Agent` header or Overpass returns 406.** Gives the venue *name*, not a LinkedIn contact — pair with `apollo`/`seed` for the profile |
| `seed` | free | leads the founder provides (`data/cso_seed.json`) | Most actionable — the `linkedin_url` is already known |
| `apollo` | free-tier | Apollo `POST /api/v1/mixed_people/search` (header `X-Api-Key`) for founders/press | **Key-gated** on `APOLLO_API_KEY`; inert without it. LinkedIn-only design: uses **search** (name/title/LinkedIn URL), **skips** the credit-burning email enrich. **Not yet live-tested** — Apollo's MCP wasn't connected when this was built; verify the response shape against your account |

## 5. The send adapter (`cso/send.py`) — dry-run by default

The in-house automated LinkedIn sender, **safe by default:**

- **Dry-run** (`CSO_SEND_LIVE=0`, default): records what it *would* send (`message.status='dry_run'`, a `dm.sent {dry_run:true}` event) and **never touches LinkedIn**.
- **Arming (the founder, not the agent builder):** live send requires `CSO_SEND_LIVE=1` **and** the founder's own `LINKEDIN_SESSION` + `PROXY_URL` in `.env`. The actual LinkedIn transport is an **intentional `NotImplementedError` stub** — the founder wires it with their own authenticated session + residential proxy. The login is never handled in the build.
- **Always enforced:** daily caps (`CSO_DAILY_INVITES=20` / `CSO_DAILY_MESSAGES=40`), randomized jitter, business-hours-only (live). A `data/.cso-sends.jsonl` counter enforces the daily cap.
- **Reality:** live unattended LinkedIn sending violates LinkedIn's ToS and risks the account; a safe residential proxy is the one non-€0 cost. Keep it dry-run unless deliberately armed.

The adapter is pluggable (`load_adapter`) — HeyReach / Unipile are future drop-ins; only the in-house `self` backend is implemented.

## 6. Modules & data model

| File | Responsibility |
|---|---|
| `cso/config.py` | wraps `cmo.config` (own DB + `chem-irl-cso` service); reads the `CSO_*` / `APOLLO_*` / `LINKEDIN_*` / `PROXY_*` knobs |
| `cso/store.py` | SQLite CRM — `lead` / `message` / `event` + stage machine |
| `cso/qualify.py` · `cso/personalize.py` | the LLM gate + drafter (Tensorix glm-5.1, with fallbacks) |
| `cso/pipeline.py` | `ingest` (idempotent) + `process` + the `python -m cso.pipeline` runner |
| `cso/connectors/{seed,osm,apollo}.py` | sourcing (§4) |
| `cso/send.py` · `cso/run_send.py` | the send adapter + its runner |
| `cso/run_source.py` | source-from-all-connectors runner |

```sql
lead(id, name, title, company, type, handle, linkedin_url, location, source, why_now,
     fit, intent, score, decision, angle, stage, owner, first_touch, next_action, created_at, updated_at)
message(id, lead_id, dir, body, status, ts)
event(id, lead_id, name, payload_json, ts)
```
Stages: `sourced → qualified → ready → sent → replied → booked → partner`, plus `nurture` / `dropped`.

## 7. Scheduling

Three systemd user timers, all **enabled** (hardened like the CMO units, `RandomizedDelaySec=300`):

- `cso-source.timer` — daily **09:00 UTC** → `cso.run_source`
- `cso-pipeline.timer` — daily **09:25 UTC** → `cso.pipeline`
- `cso-send.timer` — daily **10:00 UTC** → `cso.run_send` (dry-run)

## 8. Configuration (`.env`, shared with the CMO)

| Key | Default | Meaning |
|---|---|---|
| `CSO_SEND_BACKEND` | `self` | send backend (`self` = in-house; heyreach/unipile future) |
| `CSO_SEND_LIVE` | `0` | `0` = dry-run (safe). `1` = live (needs the two below + a wired transport) |
| `CSO_DAILY_INVITES` / `CSO_DAILY_MESSAGES` | 20 / 40 | daily caps |
| `LINKEDIN_SESSION` · `PROXY_URL` | empty | **the founder's own** — arm live send |
| `APOLLO_API_KEY` | empty | lights up the `apollo` connector |

Placeholders live in `.env.example`; real values are gitignored, never committed.

## 9. Observability · Operations · Security

- **Observability:** every step → a `chem-irl-cso` Bronto event (`lead.sourced` / `lead.enriched` / `lead.scored`, `dm.drafted` / `dm.sent`, `cso_source` / `cso_send`, `cost`) via `cmo/obs.py`; LLM spend via `cmo/cost.py`. Query with the Bronto MCP, service `chem-irl-cso`.
- **Operations:** `python -m cso.run_source` · `python -m cso.pipeline` · `python -m cso.run_send`. Pause the sales loop: `touch /root/marketing/CSO_PAUSED`. Inspect leads: the `cso.db` one-liner in the playbook's CSO section.
- **Security posture:** fully automated but the **send is dry-run**; **no LinkedIn credentials on the box** until the founder arms it; **LinkedIn-only (no email → no cold-email/GDPR surface)**; the qualify gate + rate limits + kill-switch bound activity. Live send carries real ToS/ban risk — the founder owns that decision (§5).

## 10. Still to build

Reply detection + call booking (Cal.com), the Apollo live-test + an **enrichment** step (Apollo finding
the decision-maker's LinkedIn for OSM venue *names*), and the founder arming/wiring the live send transport.

## 11. Related documents

| Document | Owns |
|---|---|
| [OPENCLAW_CMO_VPS.md](OPENCLAW_CMO_VPS.md) | the box, host, security, and the CMO (marketing) systems |
| [Stacktree CSO demo](https://stacktr.ee/p/qN35TPyWHqn6tWw55eH4PT/) | the product-facing showcase (sample data) |
| `/root/marketing/playbook.md` (VPS) — **CSO section** | Alex's operating contract for the sales role |
| [Docs index](../README.md) | where this doc is registered |
