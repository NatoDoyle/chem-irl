#!/usr/bin/env node

/**
 * Print recommended two-device testing workflow
 */

import { resolve } from 'path';

const docsPath = resolve(process.cwd(), 'docs');

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Two-Device Testing Workflow');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

console.log('1️⃣  Switch to staging environment:');
console.log('   npm run use:staging');
console.log('   npm start  # ⚠️  Restart required after switching');
console.log('');

console.log('2️⃣  Verify staging setup:');
console.log('   npm run verify:staging');
console.log('');

console.log('3️⃣  Install on phones:');
console.log('   Option A - Expo Go (quick):');
console.log('     - Install Expo Go app');
console.log('     - Run: npm start');
console.log('     - Scan QR code');
console.log('');
console.log('   Option B - EAS Dev Build (full features):');
console.log('     - Build: eas build --profile development --platform ios');
console.log('     - Install build on device');
console.log('     - Run: npm start');
console.log('');
console.log('   📖 See: docs/INSTALL_ON_PHONES.md');
console.log('');

console.log('4️⃣  Run two-device test plan:');
console.log('   📖 Follow: docs/TWO_DEVICE_TEST_PLAN.md');
console.log('');

console.log('5️⃣  Record results:');
console.log('   npm run test:log:new  # Create new test run log');
console.log('   📖 Template: docs/TEST_RUN_LOG_TEMPLATE.md');
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('📚 Documentation:');
console.log('');
console.log(`   Install Guide:     ${docsPath}/INSTALL_ON_PHONES.md`);
console.log(`   Test Plan:         ${docsPath}/TWO_DEVICE_TEST_PLAN.md`);
console.log(`   Log Template:      ${docsPath}/TEST_RUN_LOG_TEMPLATE.md`);
console.log(`   Release Checklist: ${docsPath}/RELEASE_CHECKLIST.md`);
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
