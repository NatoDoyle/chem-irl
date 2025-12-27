#!/usr/bin/env node

/**
 * Generate a new test run log file with prefilled date, time, and git commit hash
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const templatePath = resolve(process.cwd(), 'docs/TEST_RUN_LOG_TEMPLATE.md');
const testRunsDir = resolve(process.cwd(), 'test_runs');

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

  // Create test_runs directory if it doesn't exist
  mkdirSync(testRunsDir, { recursive: true });

  // Generate filename
  const filename = `${date}_${time.substring(0, 4)}_${gitHash}.md`; // YYYY-MM-DD_HHMM_hash.md
  const filepath = resolve(testRunsDir, filename);

  // Write file
  writeFileSync(filepath, content, 'utf-8');

  console.log('');
  console.log('✅ Created new test run log:');
  console.log(`   ${filepath}`);
  console.log('');
  console.log(`   Date: ${date} ${now.toTimeString().split(' ')[0].substring(0, 5)}`);
  console.log(`   Commit: ${gitHash}${gitMessage ? ` - ${gitMessage}` : ''}`);
  console.log('');
  console.log('📝 Edit the file to fill in test details.');
  console.log('');
} catch (error: any) {
  if (error.code === 'ENOENT' && error.path === templatePath) {
    console.error(`❌ Error: Template file not found: ${templatePath}`);
    process.exit(1);
  }
  console.error('❌ Error creating test run log:', error.message);
  process.exit(1);
}
