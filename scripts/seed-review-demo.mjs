#!/usr/bin/env node
/**
 * =============================================================================
 * SEED — App Store / Play review demo data (Dublin)
 * =============================================================================
 *
 * ⚠️  NOT RUN — do not run until `reviewy@chemirl.app` AND
 * `safety@chemirl.app` exist in auth.users. Each needs a ONE-TIME OTP
 * sign-in in the app first (that mints the auth.users row this script
 * looks up — see docs/operations/MODERATION_RUNBOOK.md and
 * docs/operations/STORE_SUBMISSION_PACK.md §5). The script aborts with a
 * clear message if either is missing.
 *
 * What it seeds (idempotent — safe to re-run):
 *   1. The moderator row for safety@chemirl.app in public.moderators
 *      (same effect as the SQL in MODERATION_RUNBOOK.md).
 *   2. A completed profile on reviewy@chemirl.app (dob/terms/location/
 *      bio + optional photo) so the reviewer lands in MainNavigator with
 *      a working Discover feed instead of onboarding.
 *   3. Seven fictional Dublin demo profiles for the reviewer's feed,
 *      each of which pre-likes the review account so the reviewer's
 *      first like creates a match instantly (unlocks chat / propose /
 *      report / block for the walkthrough).
 *
 * Why .mjs and not .sql: profiles require auth.users rows, and raw
 * INSERTs into auth.users break GoTrue invariants. Demo accounts are
 * minted through the supported path — the Auth Admin API
 * (POST /auth/v1/admin/users), which also fires handle_new_user() to
 * create the public.users + public.profiles rows this script then
 * fills in. Zero npm dependencies: plain fetch against the Supabase
 * Auth-Admin / PostgREST / Storage REST APIs (Node ≥ 18 or bun).
 *
 * Fixed OTP: NOT seedable here. Supabase's test-OTP feature is
 * SMS-only; the email review account needs the decision documented in
 * STORE_SUBMISSION_PACK.md §5.1 (recommended: verify-screen bypass +
 * admin-set password — a separate small client PR).
 *
 * Photos: the discovery feed NEVER surfaces photo-less profiles
 * (get_discovery_feed_v4 requires jsonb_array_length(photos) > 0), so
 * demo profiles are useless without images. Put owner-provided,
 * rights-cleared, safe-for-work portraits (e.g. licensed AI-generated
 * faces) in scripts/seed-photos/ named <slug>.jpg (optionally
 * <slug>-2.jpg …); slugs are listed below. reviewy.jpg is optional but
 * recommended. Uploads go straight to the public `profiles` bucket with
 * the service role — this intentionally bypasses the moderate-photo
 * gate, which is acceptable ONLY because the images are owner-curated.
 * Personas without a photo are seeded at completion_pct 50 and the
 * script warns loudly that they will not appear in the feed.
 *
 * Usage:
 *   1. Create .env.seed (gitignored) at the repo root or in mobile/:
 *        SUPABASE_URL=https://<project-ref>.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=<service role key>
 *      (Same convention as mobile/scripts/verifySupabase.ts. The
 *      service role key bypasses RLS — never commit it.)
 *   2. node scripts/seed-review-demo.mjs        (or: bun scripts/…)
 *      Add --yes to skip the interactive confirmation.
 * =============================================================================
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PHOTO_DIR = join(ROOT, 'scripts', 'seed-photos');

const REVIEW_EMAIL = 'reviewy@chemirl.app'; // note the 'y'
const SAFETY_EMAIL = 'safety@chemirl.app';

// --- Demo personas -----------------------------------------------------------
// Fictional. Emails are plus-addresses on the owner-controlled domain; the
// accounts are admin-created pre-confirmed, so no mailbox is ever needed.
// gender/orientation values must match the user_gender / user_orientation
// enums; relationship_intent must match INTENT_OPTIONS values
// (mobile/src/config/profileOptions.ts): casual | dating_long_term |
// long_term | open. Coordinates are Dublin neighbourhoods (city centre is
// 53.3498, -6.2603). All dobs are 18+ forever (fixed past dates).
const PERSONAS = [
  {
    slug: 'aoife',
    email: 'demo+aoife@chemirl.app',
    full_name: 'Aoife Byrne',
    gender: 'female',
    orientation: 'straight',
    dob: '1998-03-14',
    intent: 'long_term',
    bio: "Primary teacher in Rathmines. I'd rather find out over one coffee than twenty texts. Sea swims at Seapoint on Saturdays.",
    summary: 'Weekday evenings after 6, Saturday mornings',
    lat: 53.3211,
    lng: -6.2654,
  },
  {
    slug: 'cian',
    email: 'demo+cian@chemirl.app',
    full_name: 'Cian Murphy',
    gender: 'male',
    orientation: 'straight',
    dob: '1995-07-02',
    intent: 'dating_long_term',
    bio: "Engineer, five-a-side on Tuesdays. If we match, I'll propose a pint or a walk in the Phoenix Park within the week.",
    summary: 'Most evenings except Tuesday, weekends flexible',
    lat: 53.3512,
    lng: -6.2846,
  },
  {
    slug: 'saoirse',
    email: 'demo+saoirse@chemirl.app',
    full_name: 'Saoirse Kelly',
    gender: 'female',
    orientation: 'bisexual',
    dob: '1999-11-21',
    intent: 'open',
    bio: 'Illustrator around Portobello. Honest about what I want, which is currently: good conversation and better flat whites.',
    summary: 'Afternoons and weekends',
    lat: 53.3312,
    lng: -6.2653,
  },
  {
    slug: 'liam',
    email: 'demo+liam@chemirl.app',
    full_name: "Liam O'Connor",
    gender: 'male',
    orientation: 'gay',
    dob: '1996-05-09',
    intent: 'casual',
    bio: 'Nurse, gym before work, gigs at the weekend. Ask me to Workmans and I will actually show up.',
    summary: 'Off-shift evenings, most weekends',
    lat: 53.3606,
    lng: -6.2735,
  },
  {
    slug: 'niamh',
    email: 'demo+niamh@chemirl.app',
    full_name: 'Niamh Doyle',
    gender: 'female',
    orientation: 'straight',
    dob: '1993-01-27',
    intent: 'long_term',
    bio: 'Solicitor in town. My love language is making reservations and keeping them. Looking for someone who does the same.',
    summary: 'Thursday to Sunday evenings',
    lat: 53.3262,
    lng: -6.2537,
  },
  {
    slug: 'rory',
    email: 'demo+rory@chemirl.app',
    full_name: 'Rory Gallagher',
    gender: 'non_binary',
    orientation: 'pansexual',
    dob: '1997-09-15',
    intent: 'dating_long_term',
    bio: 'Barista and part-time DJ. I pick a time, you pick the place. Bull Island walks when the weather cooperates.',
    summary: 'Mornings and Sundays (hospitality hours)',
    lat: 53.3634,
    lng: -6.211,
  },
  {
    slug: 'emma',
    email: 'demo+emma@chemirl.app',
    full_name: 'Emma Walsh',
    gender: 'female',
    orientation: 'straight',
    dob: '2000-04-18',
    intent: 'casual',
    bio: "Product designer by the canal. Zero interest in pen pals — if the chat is good, let's test it in person.",
    summary: 'Weekday lunches and Friday evenings',
    lat: 53.3392,
    lng: -6.2376,
  },
];

const REVIEW_PROFILE = {
  slug: 'reviewy',
  full_name: 'Alex',
  gender: 'other',
  orientation: 'other',
  dob: '1994-06-15',
  intent: 'open',
  bio: 'App review demo account for Chem IRL (operated by the Chem IRL team).',
  summary: 'Any time — demo account',
  lat: 53.3498,
  lng: -6.2603,
};

// --- Env / config ------------------------------------------------------------

function loadEnvSeed() {
  for (const p of [join(ROOT, '.env.seed'), join(ROOT, 'mobile', '.env.seed')]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

loadEnvSeed();
const URL_BASE = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Create .env.seed (gitignored) at the repo root or in mobile/ — see header.');
  process.exit(1);
}

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// --- Tiny REST helpers -------------------------------------------------------

async function rest(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: { ...HEADERS, ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function findUserIdByEmail(email) {
  const rows = await rest(
    'GET',
    `/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=user_id`
  );
  return rows?.[0]?.user_id ?? null;
}

/** Create a pre-confirmed auth user via the Admin API (fires handle_new_user). */
async function adminCreateUser(email) {
  const created = await rest('POST', '/auth/v1/admin/users', {
    email,
    email_confirm: true,
  });
  return created.id;
}

const CONTENT_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

function photoFilesFor(slug) {
  if (!existsSync(PHOTO_DIR)) return [];
  return readdirSync(PHOTO_DIR)
    .filter((f) => {
      const ext = extname(f).toLowerCase();
      if (!(ext in CONTENT_TYPES)) return false;
      const base = f.slice(0, -ext.length);
      return base === slug || base.startsWith(`${slug}-`);
    })
    .sort();
}

/** Upload owner-provided photos to the public `profiles` bucket; returns public URLs. */
async function uploadPhotos(userId, slug) {
  const urls = [];
  for (const [i, file] of photoFilesFor(slug).entries()) {
    const ext = extname(file).toLowerCase();
    const objectPath = `${userId}/seed-${i + 1}${ext}`;
    const bytes = readFileSync(join(PHOTO_DIR, file));
    const res = await fetch(`${URL_BASE}/storage/v1/object/profiles/${objectPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': CONTENT_TYPES[ext],
        'x-upsert': 'true',
      },
      body: bytes,
    });
    if (!res.ok) {
      throw new Error(`photo upload ${file} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    urls.push(`${URL_BASE}/storage/v1/object/public/profiles/${objectPath}`);
  }
  return urls;
}

/** dob → users first (age-gate trigger reads users.dob before completion hits 100). */
async function fillProfile(userId, p, photoUrls) {
  await rest(
    'PATCH',
    `/rest/v1/users?user_id=eq.${userId}`,
    {
      dob: p.dob,
      gender: p.gender,
      orientation: p.orientation,
      city_id: 'dublin',
      timezone: 'Europe/Dublin',
      last_active_at: new Date().toISOString(),
    },
    { Prefer: 'return=minimal' }
  );
  await rest(
    'PATCH',
    `/rest/v1/profiles?id=eq.${userId}`,
    {
      full_name: p.full_name,
      prompts: { bio: p.bio, demographics: { relationship_intent: p.intent } },
      availability: {
        summary: p.summary,
        location_permission_granted: true,
        last_known_lat: p.lat,
        last_known_lng: p.lng,
      },
      photos: photoUrls,
      // Mirrors app semantics (PhotosScreen): ≥1 photo → 100, else 50.
      // The feed additionally requires ≥1 photo regardless of pct.
      completion_pct: photoUrls.length >= 1 ? 100 : 50,
      signup_completed: true,
      terms_accepted: true,
      terms_accepted_at: new Date().toISOString(),
    },
    { Prefer: 'return=minimal' }
  );
}

// --- Main --------------------------------------------------------------------

async function main() {
  const skipConfirm = process.argv.includes('--yes');
  console.log(`Target project: ${URL_BASE}`);
  console.log(
    `Plan: moderator row (${SAFETY_EMAIL}), review profile (${REVIEW_EMAIL}), ` +
      `${PERSONAS.length} demo personas + pre-likes.`
  );

  // Hard prerequisite: both role accounts must already exist (one-time OTP
  // sign-in each — this script must NOT mint them; see header).
  const reviewId = await findUserIdByEmail(REVIEW_EMAIL);
  const safetyId = await findUserIdByEmail(SAFETY_EMAIL);
  const missing = [
    ...(reviewId ? [] : [REVIEW_EMAIL]),
    ...(safetyId ? [] : [SAFETY_EMAIL]),
  ];
  if (missing.length) {
    console.error(`\nABORT — missing auth accounts: ${missing.join(', ')}`);
    console.error('Do the one-time OTP sign-in in the app for each, then re-run.');
    process.exit(1);
  }

  if (!skipConfirm) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Type "seed" to write the rows above: ');
    rl.close();
    if (answer.trim() !== 'seed') {
      console.log('Aborted (nothing written).');
      process.exit(0);
    }
  }

  // 1. Moderator row (idempotent) — REST equivalent of the runbook SQL.
  await rest('POST', '/rest/v1/moderators?on_conflict=user_id', [{ user_id: safetyId }], {
    Prefer: 'resolution=ignore-duplicates,return=minimal',
  });
  console.log(`moderators ✓ ${SAFETY_EMAIL}`);

  // 2. Review account profile.
  const reviewPhotos = await uploadPhotos(reviewId, REVIEW_PROFILE.slug);
  await fillProfile(reviewId, REVIEW_PROFILE, reviewPhotos);
  // The review account must land in MainNavigator even without a photo
  // (completion_pct >= 100 is the router gate; dob+terms already set).
  if (reviewPhotos.length === 0) {
    await rest(
      'PATCH',
      `/rest/v1/profiles?id=eq.${reviewId}`,
      { completion_pct: 100 },
      { Prefer: 'return=minimal' }
    );
  }
  console.log(`review profile ✓ ${REVIEW_EMAIL} (${reviewPhotos.length} photo(s))`);

  // 3. Personas.
  const photoless = [];
  for (const p of PERSONAS) {
    let userId = await findUserIdByEmail(p.email);
    if (!userId) userId = await adminCreateUser(p.email);

    const photos = await uploadPhotos(userId, p.slug);
    await fillProfile(userId, p, photos);
    if (photos.length === 0) photoless.push(p.slug);

    // Pre-like the review account so the reviewer's like-back creates an
    // instant match (disclosed in the Reviewer Notes).
    await rest(
      'POST',
      '/rest/v1/likes?on_conflict=liker_id,likee_id',
      [{ liker_id: userId, likee_id: reviewId }],
      { Prefer: 'resolution=ignore-duplicates,return=minimal' }
    );
    console.log(`persona ✓ ${p.full_name} <${p.email}> (${photos.length} photo(s))`);
  }

  if (photoless.length) {
    console.warn(
      `\n⚠️  NO PHOTOS for: ${photoless.join(', ')} — the discovery feed drops ` +
        'photo-less profiles (get_discovery_feed_v4), so these will NOT be ' +
        `visible to the reviewer. Add <slug>.jpg files to ${PHOTO_DIR} and re-run.`
    );
  }
  console.log('\nDone. Verify in the app: sign in as the review account and check Discover.');
}

main().catch((err) => {
  console.error(`\nSeed failed: ${err.message}`);
  process.exit(1);
});
