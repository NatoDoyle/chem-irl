-- Special-category (Art. 9) consent record (launch-readiness GAP-1 from
-- docs/operations/DPIA.md). SCAFFOLDING — the consent COPY/mechanism still
-- needs data-protection sign-off; this lands the durable record column so
-- the wiring is ready.
--
-- The app collects sexual orientation (users.orientation, set on the
-- InterestedIn onboarding step) — GDPR Art. 9 special-category data, which
-- needs explicit, specific, UNBUNDLED consent (the combined 18+/ToS/Privacy
-- signup checkbox does not qualify). This column records WHEN the user gave
-- a distinct, point-of-collection consent to special-category processing.
-- NULL = not yet given. Co-located with the data it covers (users), so the
-- DSAR export (which dumps the whole users row) includes it automatically.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS special_category_consent_at TIMESTAMPTZ;

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');
