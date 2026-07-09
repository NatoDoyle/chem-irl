#!/usr/bin/env node

/**
 * Generate a new beta smoke test run log file with prefilled metadata
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
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

  // Try to read app version and Expo SDK version
  let appVersion = '[version]';
  let expoSdkVersion = '[version]';
  try {
    const appJsonPath = resolve(process.cwd(), 'app.json');
    const appJson = JSON.parse(readFileSync(appJsonPath, 'utf-8'));
    if (appJson?.expo?.version) {
      appVersion = appJson.expo.version;
    }
  } catch {
    // Ignore if app.json can't be read
  }

  try {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    if (packageJson?.dependencies?.expo) {
      // Extract version number from semver (e.g., "~54.0.27" -> "54")
      const match = packageJson.dependencies.expo.match(/~?(\d+)\./);
      if (match) {
        expoSdkVersion = match[1];
      }
    }
  } catch {
    // Ignore if package.json can't be read
  }

  /**
   * Extract Supabase hostname from an env file
   * Returns null if file doesn't exist or URL can't be parsed
   */
  function extractHostFromEnvFile(filePath: string): string | null {
    try {
      if (!existsSync(filePath)) {
        return null;
      }

      const envContent = readFileSync(filePath, 'utf-8');
      const lines = envContent.split('\n');

      for (const line of lines) {
        // Skip comments and empty lines
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Match EXPO_PUBLIC_SUPABASE_URL=value (with or without quotes)
        const match = trimmed.match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/);
        if (match) {
          let url = match[1].trim();
          // Remove quotes if present
          if (
            (url.startsWith('"') && url.endsWith('"')) ||
            (url.startsWith("'") && url.endsWith("'"))
          ) {
            url = url.slice(1, -1);
          }

          // Parse URL and extract hostname only
          try {
            const urlObj = new URL(url);
            return urlObj.hostname;
          } catch {
            // Invalid URL format
            return null;
          }
        }
      }
    } catch {
      // Ignore if env file can't be read
    }
    return null;
  }

  // Read Supabase URL host from active env file (.env.local or .env)
  const envLocalPath = resolve(process.cwd(), '.env.local');
  const envPath = resolve(process.cwd(), '.env');
  let supabaseHost = '[unknown]';
  const activeHost = extractHostFromEnvFile(envLocalPath) || extractHostFromEnvFile(envPath);
  if (activeHost) {
    supabaseHost = activeHost;
  }

  // Read staging and production env files to determine environment
  const stagingPath = resolve(process.cwd(), '.env.staging');
  const productionPath = resolve(process.cwd(), '.env.production');
  const stagingHost = extractHostFromEnvFile(stagingPath);
  const productionHost = extractHostFromEnvFile(productionPath);

  // Determine detected environment
  let detectedEnv = 'unknown';
  if (activeHost) {
    if (stagingHost && activeHost === stagingHost) {
      detectedEnv = 'staging';
    } else if (productionHost && activeHost === productionHost) {
      detectedEnv = 'production';
    }
  }

  // Replace placeholders in template
  let content = template.replace(/\[YYYY-MM-DD\]/g, date);
  content = content.replace(/\[HH:MM\]/g, now.toTimeString().split(' ')[0].substring(0, 5)); // HH:MM
  content = content.replace(/\[version\]/g, (match, offset, string) => {
    // Check context to determine if it's app version or SDK version
    const beforeMatch = string.substring(Math.max(0, offset - 20), offset);
    if (beforeMatch.includes('Expo SDK')) {
      return expoSdkVersion;
    }
    return appVersion;
  });

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

- [ ] \`bun run use:staging\` executed
- [ ] Expo restarted after env switch
- [ ] \`bun run verify:staging\` passed
- [ ] Confirm detected environment: **${detectedEnv}**${detectedEnv === 'unknown' ? '\n  Hint: create .env.staging/.env.production or run `bun run use:staging` / `bun run use:production`' : ''}
- [ ] Confirm Supabase URL host: **${supabaseHost}**
- [ ] Phones installed using Expo Go
- [ ] Phones installed using Dev build
- [ ] Phones installed using Production build

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

  // Print absolute path and next steps
  const absolutePath = resolve(filepath);

  console.log('');
  console.log(`✅ Created beta smoke log: ${absolutePath}`);
  console.log('');
  console.log('Next: open the file, complete Pre-flight, then follow docs/BETA_SMOKE_CHECKLIST.md');
  console.log('');
} catch (error: any) {
  if (error.code === 'ENOENT' && error.path === templatePath) {
    console.error(`❌ Error: Template file not found: ${templatePath}`);
    process.exit(1);
  }
  console.error('❌ Error creating beta smoke test run log:', error.message);
  process.exit(1);
}
