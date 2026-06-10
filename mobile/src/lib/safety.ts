// Safety helpers: block / unblock a user and submit a report.
//
// These wrap the deployed Postgres RPCs (`block_user`, `unblock_user`,
// `submit_report`). Blocking auto-unmatches server-side; reporting is
// independent of blocking. Each helper returns `{ success, error? }` and
// mirrors the error handling in `tokens.ts`.

import { supabase } from './supabase/client';
import { addBreadcrumb } from './sentry';
import { trackEvent } from './analytics';
import type { ReportCategory } from './types';

/**
 * Block another user. Server-side this also removes any existing match.
 */
export async function blockUser(userId: string): Promise<{ success: boolean; error?: string }> {
  addBreadcrumb('Blocking user', 'safety', 'warning', { targetId: userId.substring(0, 8) });

  const { error } = await supabase.rpc('block_user', { p_blockee: userId });

  if (error) {
    return { success: false, error: error.message };
  }

  trackEvent('user_blocked', { targetId: userId.substring(0, 8) });
  return { success: true };
}

/**
 * Unblock a previously blocked user.
 */
export async function unblockUser(userId: string): Promise<{ success: boolean; error?: string }> {
  addBreadcrumb('Unblocking user', 'safety', 'info', { targetId: userId.substring(0, 8) });

  const { error } = await supabase.rpc('unblock_user', { p_blockee: userId });

  if (error) {
    return { success: false, error: error.message };
  }

  trackEvent('user_unblocked', { targetId: userId.substring(0, 8) });
  return { success: true };
}

/**
 * Submit a report against another user. Does not block them.
 */
export async function submitReport(
  userId: string,
  category: ReportCategory,
  description?: string
): Promise<{ success: boolean; error?: string }> {
  addBreadcrumb('Submitting report', 'safety', 'warning', {
    targetId: userId.substring(0, 8),
    category,
  });

  const { error } = await supabase.rpc('submit_report', {
    p_accused: userId,
    p_category: category,
    p_description: description?.trim() || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  trackEvent('report_submitted', { category });
  return { success: true };
}
