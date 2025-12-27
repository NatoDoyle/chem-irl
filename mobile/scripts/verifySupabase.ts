#!/usr/bin/env node

/**
 * Verify Supabase staging/production setup
 * Checks that required tables, RPCs, and storage buckets exist
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.seed for service role key (local-only, gitignored)
config({ path: resolve(process.cwd(), '.env.seed') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Error: Missing required environment variables');
  console.error('');
  console.error('Create .env.seed file with:');
  console.error('  SUPABASE_URL=https://your-project.supabase.co');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  console.error('');
  console.error('⚠️  WARNING: Service role key bypasses RLS. Keep .env.seed gitignored!');
  process.exit(1);
}

// Create admin client with service role key for verification
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

interface VerificationResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: VerificationResult[] = [];

async function verifyTables(): Promise<void> {
  const requiredTables = ['profiles', 'matches', 'proposals', 'confirms', 'messages'];

  for (const tableName of requiredTables) {
    try {
      // Try to query the table (will fail if it doesn't exist)
      const { error } = await supabase.from(tableName).select('*').limit(1);

      if (error) {
        if (error.code === '42P01') {
          // Table does not exist
          results.push({
            name: `Table: ${tableName}`,
            passed: false,
            error: 'Table does not exist',
          });
        } else {
          // Other error (might be RLS, but table exists)
          // If we get a non-table-exists error, table likely exists
          results.push({
            name: `Table: ${tableName}`,
            passed: true,
          });
        }
      } else {
        results.push({
          name: `Table: ${tableName}`,
          passed: true,
        });
      }
    } catch (err: any) {
      results.push({
        name: `Table: ${tableName}`,
        passed: false,
        error: err.message || 'Unknown error',
      });
    }
  }
}

async function verifyRPCs(): Promise<void> {
  const requiredRPCs = [
    {
      name: 'get_discovery_feed',
      params: { p_viewer: '00000000-0000-0000-0000-000000000000', p_limit: 1 },
    },
    {
      name: 'create_like_and_check_match',
      params: {
        p_liker: '00000000-0000-0000-0000-000000000000',
        p_likee: '00000000-0000-0000-0000-000000000000',
      },
    },
  ];

  for (const rpc of requiredRPCs) {
    try {
      const { error } = await supabase.rpc(rpc.name, rpc.params as any);

      // If function doesn't exist, we'll get a specific error
      if (error) {
        if (error.message?.includes('function') && error.message?.includes('does not exist')) {
          results.push({
            name: `RPC: ${rpc.name}`,
            passed: false,
            error: 'Function does not exist',
          });
        } else {
          // Function exists, but call failed (expected with dummy params)
          results.push({
            name: `RPC: ${rpc.name}`,
            passed: true,
          });
        }
      } else {
        results.push({
          name: `RPC: ${rpc.name}`,
          passed: true,
        });
      }
    } catch (err: any) {
      // Check if error is about function not existing
      if (err.message?.includes('function') && err.message?.includes('does not exist')) {
        results.push({
          name: `RPC: ${rpc.name}`,
          passed: false,
          error: 'Function does not exist',
        });
      } else {
        results.push({
          name: `RPC: ${rpc.name}`,
          passed: true,
        });
      }
    }
  }
}

async function verifyStorage(): Promise<void> {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      results.push({
        name: 'Storage: profiles bucket',
        passed: false,
        error: error.message,
      });
      return;
    }

    const profilesBucket = buckets?.find((b) => b.name === 'profiles');

    if (!profilesBucket) {
      results.push({
        name: 'Storage: profiles bucket',
        passed: false,
        error: 'Bucket "profiles" does not exist',
      });
      return;
    }

    results.push({
      name: 'Storage: profiles bucket',
      passed: true,
    });
  } catch (err: any) {
    results.push({
      name: 'Storage: profiles bucket',
      passed: false,
      error: err.message || 'Unknown error',
    });
  }
}

async function main() {
  console.log('Verifying Supabase setup...');
  console.log(`Project: ${supabaseUrl}`);
  console.log('');

  await verifyTables();
  await verifyRPCs();
  await verifyStorage();

  // Print results
  let allPassed = true;
  for (const result of results) {
    if (result.passed) {
      console.log(`✅ ${result.name}`);
    } else {
      console.log(`❌ ${result.name}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      allPassed = false;
    }
  }

  console.log('');

  if (allPassed) {
    console.log('✅ All checks passed!');
    process.exit(0);
  } else {
    console.log('❌ Some checks failed. Please fix the issues above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
