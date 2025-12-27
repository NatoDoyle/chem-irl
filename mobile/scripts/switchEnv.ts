#!/usr/bin/env node

/**
 * Script to switch between staging and production environment files
 */

import { copyFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const target = process.argv[2]; // 'staging' or 'production'

if (!target || !['staging', 'production'].includes(target)) {
  console.error('Usage: tsx scripts/switchEnv.ts <staging|production>');
  process.exit(1);
}

const sourceFile = resolve(process.cwd(), `.env.${target}`);
const targetFile = resolve(process.cwd(), '.env.local');

if (!existsSync(sourceFile)) {
  console.error(`❌ Error: ${sourceFile} does not exist.`);
  console.error(`   Please create it based on .env.${target}.example`);
  process.exit(1);
}

try {
  copyFileSync(sourceFile, targetFile);
  console.log(`✅ Switched to ${target} environment`);
  console.log(`   Copied .env.${target} → .env.local`);
  console.log('');
  console.log('⚠️  IMPORTANT: Restart Expo dev server for changes to take effect:');
  console.log('   npm start');
  console.log('');
} catch (error: any) {
  console.error(`❌ Error copying file: ${error.message}`);
  process.exit(1);
}
