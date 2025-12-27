#!/usr/bin/env node

/**
 * Environment variable sanity check script
 * Verifies required Expo public env vars are set before building/running
 */

// Load .env file if it exists
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const REQUIRED_VARS = [
  {
    name: 'EXPO_PUBLIC_SUPABASE_URL',
    description: 'Supabase project URL',
  },
  {
    name: 'EXPO_PUBLIC_SUPABASE_KEY',
    description: 'Supabase publishable key',
  },
];

interface EnvCheckResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

function checkEnv(): EnvCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required vars
  for (const { name, description } of REQUIRED_VARS) {
    // eslint-disable-next-line expo/no-dynamic-env-var
    const value = process.env[name];
    if (!value || value.trim() === '') {
      errors.push(`Missing required env var: ${name} (${description})`);
    }
  }

  // Check Sentry configuration if DSN is provided
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (sentryDsn) {
    const environment = process.env.EXPO_PUBLIC_ENVIRONMENT;
    if (!environment || environment.trim() === '') {
      warnings.push(
        'EXPO_PUBLIC_SENTRY_DSN is set but EXPO_PUBLIC_ENVIRONMENT is not set. Sentry will use default environment.'
      );
    } else if (environment === 'development') {
      warnings.push(
        'EXPO_PUBLIC_ENVIRONMENT is set to "development". Sentry error logging is disabled in development.'
      );
    } else if (environment === 'production') {
      // Production with Sentry - this is good, no warning needed
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

function main() {
  const result = checkEnv();

  if (result.errors.length > 0) {
    console.error('❌ Environment check failed:\n');
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    console.error('\nPlease set required environment variables in .env file');
    console.error('See README.md for environment variable setup.\n');
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment check passed with warnings:\n');
    for (const warning of result.warnings) {
      console.warn(`  - ${warning}`);
    }
    console.warn('');
  } else {
    console.log('✅ Environment check passed\n');
  }

  process.exit(0);
}

main();
