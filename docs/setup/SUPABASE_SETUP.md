# Supabase Connection — Marketing Site (`web/`)

> **Scope:** the static marketing site only. `web/` is a Next.js **static export**
> (`output: 'export'`) — there are **no API routes, no server-side Supabase client,
> and no middleware**. Anything dynamic goes through Supabase edge functions.
> For the mobile app's Supabase setup see
> [`mobile/docs/SUPABASE_STAGING_SETUP.md`](../../mobile/docs/SUPABASE_STAGING_SETUP.md);
> for schema bootstrap and migrations see [`DATABASE_SETUP.md`](./DATABASE_SETUP.md).

## How the site talks to Supabase

Two build-time environment variables, both read by `web/src/lib/waitlist.ts` and
`web/src/lib/support.ts`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key)

**Writes** never touch tables directly from the browser. Forms POST to
anonymous-callable edge functions (`verify_jwt = false` in `supabase/config.toml`),
which use a service-role client server-side to call SECURITY DEFINER RPCs:

| Form / surface | Edge function |
|---|---|
| Waitlist form (`/download`) | `waitlist-signup` |
| Email confirm link | `waitlist-confirm` |
| GDPR "forget me" | `waitlist-forget` |
| Blog sidebar subscribe | `waitlist-blog-subscribe` |
| `/support` + Solutions inquiry | `support-submit` |

**Reads** (waitlist position, live signup counter, referrer first name, published
support tips) go through supabase-js with the publishable key, calling SECURITY
DEFINER RPCs that expose no PII (`waitlist_position_for_code_v2`,
`waitlist_count_dublin`, `waitlist_referrer_first_name`, `list_published_tips`).

> **Do NOT set `SUPABASE_SERVICE_ROLE_KEY` in Vercel.** Nothing server-side runs
> there — the site is a static export — so the key would never be used, and a
> leaked build environment would be pure liability. Service-role logic lives only
> inside edge functions (as Supabase secrets).

## Getting the values

Supabase Dashboard → **Settings → API** → Project URL + publishable (anon) key.
Or via CLI/MCP: `supabase projects list` and the project's API settings.

## Local development

```bash
cp web/.env.example web/.env   # then fill in the two NEXT_PUBLIC_ vars
cd web && bun run dev
```

## Vercel

1. Vercel project → **Settings → Environment Variables**.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for
   **Production** and **Preview**.
3. Redeploy — the values are inlined into the static bundle at build time, so a
   redeploy is required for changes to take effect.

## Verify

```bash
cd web && bun run build   # static export must succeed
```

Then submit the waitlist form on a preview deploy and check either the
`waitlist_signups` table or the function logs:

```bash
supabase functions logs waitlist-signup --tail
```

## Troubleshooting

- **Forms show a config error / do nothing** — the two `NEXT_PUBLIC_` vars were
  unset at build time; `getSupabaseClient()` returns `null` and the helpers return
  `configuration_missing`. Set the vars and rebuild.
- **CORS errors in the browser console** — the edge functions allowlist origins
  via the shared `WAITLIST_ALLOWED_ORIGINS` secret; make sure the deploy's domain
  is in it.
- **Signup works but no confirmation email** — the email path is intentionally
  fail-soft; see the Resend section in `web/env.example` (the keys must be set as
  Supabase edge-function secrets, not Vercel env vars).
