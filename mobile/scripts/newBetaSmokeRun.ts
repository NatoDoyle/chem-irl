#!/usr/bin/env node

/**
 * Generate a new beta smoke test run log file with prefilled metadata
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const templatePath = resolve(process.cwd(), 'docs/TEST_RUN_LOG_TEMPLATE.md');
const testRunsDir = resolve(process.cwd(), 'test_runs/beta_smoke');

try {
  // Read template
  const template = readFileSync(templatePath, 'utf-8');

  // Get current date/time
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS

  // Get git commit hash (short)
  let gitHash = 'unknown';
  try {
    gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    console.warn('⚠️  Warning: Could not get git commit hash. Using "unknown".');
  }

  // Get git commit message (first line)
  let gitMessage = '';
  try {
    gitMessage = execSync('git log -1 --pretty=%s', { encoding: 'utf-8' }).trim();
  } catch {
    // Ignore if git command fails
  }

  // Replace placeholders in template
  let content = template.replace(/\[YYYY-MM-DD\]/g, date);
  content = content.replace(/\[HH:MM\]/g, now.toTimeString().split(' ')[0].substring(0, 5)); // HH:MM

  // Replace git commit line
  if (gitMessage) {
    content = content.replace(/\[hash\] - \[short commit message\]/g, `${gitHash} - ${gitMessage}`);
  } else {
    content = content.replace(/\[hash\] - \[short commit message\]/g, gitHash);
  }

  // Add beta smoke header and pre-flight section at the top
  const betaHeader = `# Beta Smoke Test Run

**Test Type:** Beta Smoke (Core Loop Only)  
**Checklist:** See [BETA_SMOKE_CHECKLIST.md](../docs/BETA_SMOKE_CHECKLIST.md)

---

## Pre-flight Checks

**⚠️  Complete before starting tests to avoid common setup mistakes:**

- [ ] \`npm run use:staging\` executed
- [ ] Expo restarted after env switch
- [ ] \`npm run verify:staging\` passed
- [ ] Phones installed using: [ ] Expo Go  [ ] Dev build  [ ] Production build

---

`;

  content = betaHeader + content;

  // Simplify Test Results section to match beta smoke checklist
  // Replace the full test results with a focused beta smoke section
  const betaSmokeSection = `## Beta Smoke Test Results

**Follow:** [docs/BETA_SMOKE_CHECKLIST.md](../docs/BETA_SMOKE_CHECKLIST.md) for detailed steps.

### Quick Checklist

- [ ] 1. Auth & Session
- [ ] 2. Onboarding (if needed)
- [ ] 3. Discovery & Mutual Match (realtime)
- [ ] 4. Proposals (date/time picker constraints)
- [ ] 5. Chat (realtime)
- [ ] 6. Profile Edit & Photo Delete
- [ ] 7. Sign Out

---

## Test Results

`;

  // Find and replace the Test Results section
  const testResultsStart = content.indexOf('## Test Results');
  if (testResultsStart !== -1) {
    const testResultsEnd = content.indexOf('## Bugs Found', testResultsStart);
    if (testResultsEnd !== -1) {
      content =
        content.slice(0, testResultsStart) + betaSmokeSection + content.slice(testResultsEnd);
    }
  }

  // Create test_runs/beta_smoke directory if it doesn't exist
  mkdirSync(testRunsDir, { recursive: true });

  // Generate filename
  const filename = `${date}_${time.substring(0, 4)}_${gitHash}.md`; // YYYY-MM-DD_HHMM_hash.md
  const filepath = resolve(testRunsDir, filename);

  // Write file
  writeFileSync(filepath, content, 'utf-8');

  console.log('');
  console.log('✅ Created new beta smoke test run log:');
  console.log(`   ${filepath}`);
  console.log('');
  console.log(`   Date: ${date} ${now.toTimeString().split(' ')[0].substring(0, 5)}`);
  console.log(`   Commit: ${gitHash}${gitMessage ? ` - ${gitMessage}` : ''}`);
  console.log('');
  console.log('📋 Checklist: docs/BETA_SMOKE_CHECKLIST.md');
  console.log('📝 Edit the file to fill in test results.');
  console.log('');
} catch (error: any) {
  if (error.code === 'ENOENT' && error.path === templatePath) {
    console.error(`❌ Error: Template file not found: ${templatePath}`);
    process.exit(1);
  }
  console.error('❌ Error creating beta smoke test run log:', error.message);
  process.exit(1);
}
