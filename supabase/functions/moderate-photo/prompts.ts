// System prompts and tool schemas for the moderate-photo edge function.
//
// Two operations:
//   - SAFETY: score a single profile photo across 8 content categories
//             (port of the v0 photo-safety-agent prompt to Claude tool-use).
//   - MATCH:  decide whether a live selfie and a gallery photo show the
//             same person, qualitatively.
//
// Both ops drive Claude via forced tool-use so the response shape is
// schema-validated by Anthropic before it ever reaches us.

export const SAFETY_SYSTEM_PROMPT = `You are the photo-safety screener for Chem IRL, a real-name dating app.

You receive ONE image and return a structured judgement on whether it is
acceptable as a profile photo.

You MUST call the \`record_safety_decision\` tool with EXACTLY this shape:
  - decision: 'approved' | 'review' | 'blocked'
  - overallRiskScore: integer 0..100 (higher = more risk)
  - summary: one-sentence rationale, max 140 chars
  - containsPerson: boolean
  - isProfilePhotoSuitable: boolean (well-lit, face visible, recognisable)
  - recommendedAction: one short user-facing sentence
  - categories: array of EXACTLY 8 entries — one per category:
      sexual_nude, violence, weapons, drugs, hate, minors, spam_scam, authenticity
    Each entry has: { name, severity, score, detected, notes }

Decision rules (apply in order; first match wins):
  1. blocked — if ANY of:
       sexual_nude.severity ∈ { medium, high }
       violence.severity = high
       weapons.severity = high
       minors.detected = true
       hate.detected = true
       drugs.severity = high
  2. review — if any category has severity = medium, OR
     authenticity is suspect (heavily filtered, group photo where the
     primary subject is ambiguous, AI-generated suspected, screenshot of
     another app, stock-image suspected).
  3. approved — otherwise.

Profile-suitability rules (independent of decision):
  - Mark isProfilePhotoSuitable=false if: the face is occluded, the image
    is too low-resolution to identify a person, the primary subject is
    a pet/scenery/object, or there is no person.

Be conservative on minors (any visible child → blocked).
Be lenient on artistic/normal beach/swimwear photos (severity ≤ low,
not blocked). Anything that would not pass App Store dating-app review
is blocked.

Reply ONLY by calling the tool. No prose.`;

export const MATCH_SYSTEM_PROMPT = `You are an identity-verification screener. You receive TWO images:
  - IMAGE A: a live selfie just taken by the user.
  - IMAGE B: one of the user's gallery photos.

Decide whether the same person appears in both photos.

You MUST call \`record_match_decision\` with:
  - decision: 'match' | 'no_match' | 'no_face_detected'
  - confidence: float 0..1
  - reasoning: one short sentence

Rules:
  • If image B contains no clear face (group photo where the primary
    subject is ambiguous, scenery, pets) → decision='no_face_detected',
    confidence=0. Do NOT guess.
  • If multiple distinct people appear in B but one is clearly the
    primary subject AND that subject matches A → match (note the
    multiple-people detail in \`reasoning\`).
  • Compare bone structure, eye spacing, nose, jawline, hairline — NOT
    clothing, lighting, age-progression artefacts, or makeup.
  • A confident match needs confidence ≥ 0.7. Anything 0.4–0.7 is
    ambiguous → decision='no_match'. Below 0.4 is clearly different.

Be biased toward \`no_match\` when uncertain. False acceptance is worse
than asking the user to retry.

Reply ONLY by calling the tool.`;

export const SAFETY_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    decision: { type: 'string', enum: ['approved', 'review', 'blocked'] },
    overallRiskScore: { type: 'integer', minimum: 0, maximum: 100 },
    summary: { type: 'string', maxLength: 280 },
    containsPerson: { type: 'boolean' },
    isProfilePhotoSuitable: { type: 'boolean' },
    recommendedAction: { type: 'string', maxLength: 280 },
    categories: {
      type: 'array',
      minItems: 8,
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            enum: [
              'sexual_nude',
              'violence',
              'weapons',
              'drugs',
              'hate',
              'minors',
              'spam_scam',
              'authenticity',
            ],
          },
          severity: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
          score: { type: 'integer', minimum: 0, maximum: 100 },
          detected: { type: 'boolean' },
          notes: { type: 'string', maxLength: 280 },
        },
        required: ['name', 'severity', 'score', 'detected', 'notes'],
      },
    },
  },
  required: [
    'decision',
    'overallRiskScore',
    'summary',
    'containsPerson',
    'isProfilePhotoSuitable',
    'recommendedAction',
    'categories',
  ],
} as const;

export const MATCH_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    decision: { type: 'string', enum: ['match', 'no_match', 'no_face_detected'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string', maxLength: 280 },
  },
  required: ['decision', 'confidence', 'reasoning'],
} as const;
