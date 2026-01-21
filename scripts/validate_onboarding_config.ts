/**
 * Validation script to check STEP_CONFIGS against OnboardingNavigator
 * Run: npx ts-node scripts/validate_onboarding_config.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const constantsPath = path.join(__dirname, '../mobile/src/lib/onboarding/constants.ts');
const navigatorPath = path.join(__dirname, '../mobile/src/navigation/OnboardingNavigator.tsx');

const constantsContent = fs.readFileSync(constantsPath, 'utf8');
const navigatorContent = fs.readFileSync(navigatorPath, 'utf8');

// Extract screen names from navigator
const screenNameMatches = navigatorContent.matchAll(/name="([^"]+)"/g);
const navigatorScreens = new Set<string>();
for (const match of screenNameMatches) {
  navigatorScreens.add(match[1]);
}

// Extract step configs
const stepIds: string[] = [
  'account_creation',
  'terms_acceptance',
  'email_verification',
  'phone_verification',
  'date_of_birth',
  'gender_identity',
  'interested_in',
  'location_permission',
  'profile_photos',
  'height',
  'languages',
  'relationship_intent',
  'family_plans',
  'pets',
  'substances',
  'lifestyle_habits',
  'interests',
  'ideal_first_dates',
  'love_language',
  'personality_type',
  'astrology_sign',
  'work_education',
  'bio',
  'photo_verification',
  'profile_review',
  'enter_app',
];

console.log('stepId | enabled | screenName | existsInNavigator');
console.log('------|---------|------------|------------------');

const issues: string[] = [];

for (const stepId of stepIds) {
  // Extract enabled value
  const enabledMatch = constantsContent.match(
    new RegExp(`${stepId}:\\s*{[\\s\\S]*?enabled:\\s*(true|false|undefined)`, 'm')
  );
  const enabled = enabledMatch ? enabledMatch[1] : 'true';

  // Extract screenName value
  const screenNameMatch = constantsContent.match(
    new RegExp(`${stepId}:\\s*{[\\s\\S]*?screenName:\\s*([^,\\n}]+)`, 'm')
  );
  let screenName = 'undefined';
  if (screenNameMatch) {
    screenName = screenNameMatch[1].trim().replace(/['"]/g, '').replace(/\/\/.*$/, '').trim();
    if (screenName === 'undefined') {
      screenName = 'undefined';
    }
  }

  const existsInNavigator = screenName !== 'undefined' && navigatorScreens.has(screenName) ? 'YES' : 'NO';

  // Check for issues
  if (enabled === 'true' && screenName === 'undefined') {
    issues.push(`${stepId}: enabled=true but screenName is undefined`);
  } else if (enabled === 'true' && screenName !== 'undefined' && existsInNavigator === 'NO') {
    issues.push(`${stepId}: screenName="${screenName}" not found in OnboardingNavigator`);
  }

  console.log(`${stepId.padEnd(20)} | ${enabled.padEnd(7)} | ${screenName.padEnd(10)} | ${existsInNavigator}`);
}

if (issues.length > 0) {
  console.log('\n❌ Issues found:');
  issues.forEach((issue) => console.log(`  - ${issue}`));
  process.exit(1);
} else {
  console.log('\n✅ All enabled steps have valid screenNames in OnboardingNavigator');
}
