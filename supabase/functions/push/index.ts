// Supabase Edge Function: Push Notifications
// Handles database webhooks and sends push notifications via Expo Push API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const PUSH_WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') || '';

// Debounce map: user_id -> event_type -> last_sent_timestamp
const debounceMap = new Map<string, Map<string, number>>();
const DEBOUNCE_WINDOW_MS = 5000; // 5 seconds

// Deduplication: track processed events to prevent duplicate notifications
// Key: `${table}:${record_id}:${event}`, Value: timestamp
const processedEvents = new Map<string, number>();
const DEDUP_TTL_MS = 60000; // 1 minute TTL for deduplication cache

serve(async (req) => {
  try {
    // SECURITY: Verify webhook secret before processing
    const webhookSecret = req.headers.get('x-webhook-secret');
    if (!PUSH_WEBHOOK_SECRET) {
      return new Response(
        JSON.stringify({ error: 'PUSH_WEBHOOK_SECRET not configured' }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }
    if (!webhookSecret || webhookSecret !== PUSH_WEBHOOK_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing webhook secret' }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Verify required environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Missing required environment variables' }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Create Supabase client with service role key
    // NOTE: Service role key is ONLY used for querying tokens and sending pushes
    // Authentication is handled via x-webhook-secret header above
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse webhook payload
    const payload = await req.json();
    const { table, event, record, old_record } = payload;

    if (event !== 'INSERT') {
      return new Response(JSON.stringify({ message: 'Only INSERT events are handled' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // DEDUPLICATION: Check if we've already processed this event
    // Use table + record primary key + event type as deduplication key
    // Primary keys: matches.match_id, proposals.proposal_id, messages.message_id, confirms.confirm_id
    const recordId =
      record.match_id || record.proposal_id || record.message_id || record.confirm_id || record.id;
    const dedupKey = `${table}:${recordId}:${event}`;
    const now = Date.now();
    const processedAt = processedEvents.get(dedupKey);

    // Clean up old entries (older than TTL)
    for (const [key, timestamp] of processedEvents.entries()) {
      if (now - timestamp > DEDUP_TTL_MS) {
        processedEvents.delete(key);
      }
    }

    // If event was processed recently, skip it
    if (processedAt && now - processedAt < DEDUP_TTL_MS) {
      return new Response(
        JSON.stringify({
          message: 'Event already processed (deduplicated)',
          dedupKey,
          processedAt: new Date(processedAt).toISOString(),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Mark event as processed
    processedEvents.set(dedupKey, now);

    // Determine notification type and recipients
    let notificationType: string;
    let recipients: string[] = [];
    let notificationTitle: string;
    let notificationBody: string;
    let notificationData: Record<string, any> = {};

    if (table === 'messages') {
      notificationType = 'message';
      const matchId = record.match_id;
      const senderId = record.sender_id;

      // Get other user in match (recipient)
      const { data: match } = await supabase
        .from('matches')
        .select('user_a, user_b')
        .eq('match_id', matchId)
        .single();

      if (match) {
        const recipientId = match.user_a === senderId ? match.user_b : match.user_a;
        recipients = [recipientId];
      }

      // Truncate message content for notification
      const contentPreview = record.content.length > 50
        ? record.content.substring(0, 50) + '...'
        : record.content;

      notificationTitle = 'New Message';
      notificationBody = contentPreview;
      notificationData = { type: 'message', matchId };
    } else if (table === 'matches') {
      notificationType = 'match';
      // Notify both users (they both matched)
      recipients = [record.user_a, record.user_b];

      notificationTitle = 'New Match!';
      notificationBody = 'You have a new match';
      notificationData = { type: 'match', matchId: record.match_id };
    } else if (table === 'proposals') {
      notificationType = 'proposal';
      const matchId = record.match_id;
      const senderId = record.sender_id;

      // Get other user in match (recipient)
      const { data: match } = await supabase
        .from('matches')
        .select('user_a, user_b')
        .eq('match_id', matchId)
        .single();

      if (match) {
        const recipientId = match.user_a === senderId ? match.user_b : match.user_a;
        recipients = [recipientId];
      }

      notificationTitle = 'New Date Proposal';
      notificationBody = 'You received a new date proposal';
      notificationData = { type: 'proposal', matchId, proposalId: record.proposal_id };
    } else if (table === 'confirms') {
      notificationType = 'confirm';
      const matchId = record.match_id;
      const confirmerId = record.confirmer_id;

      // Get other user in match (recipient)
      const { data: match } = await supabase
        .from('matches')
        .select('user_a, user_b')
        .eq('match_id', matchId)
        .single();

      if (match) {
        const recipientId = match.user_a === confirmerId ? match.user_b : match.user_a;
        recipients = [recipientId];
      }

      notificationTitle = 'Date Confirmed!';
      notificationBody = 'Your date proposal was confirmed';
      notificationData = { type: 'confirm', matchId, proposalId: record.proposal_id };
    } else {
      return new Response(
        JSON.stringify({ message: `Unsupported table: ${table}` }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No recipients found' }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Send notifications to all recipients
    const results = [];
    for (const recipientId of recipients) {
      // Debounce check
      const now = Date.now();
      const userDebounce = debounceMap.get(recipientId) || new Map();
      const lastSent = userDebounce.get(notificationType) || 0;

      if (now - lastSent < DEBOUNCE_WINDOW_MS) {
        results.push({ recipientId, skipped: true, reason: 'debounced' });
        continue;
      }

      // Update debounce map
      userDebounce.set(notificationType, now);
      debounceMap.set(recipientId, userDebounce);

      // Get enabled push tokens for recipient
      const { data: tokens, error: tokensError } = await supabase
        .from('push_tokens')
        .select('expo_push_token')
        .eq('user_id', recipientId)
        .eq('enabled', true);

      if (tokensError || !tokens || tokens.length === 0) {
        results.push({ recipientId, skipped: true, reason: 'no tokens' });
        continue;
      }

      // Send notification to each token
      for (const tokenRow of tokens) {
        try {
          const expoPushToken = tokenRow.expo_push_token;
          const pushResponse = await fetch(EXPO_PUSH_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Accept-Encoding': 'gzip, deflate',
            },
            body: JSON.stringify({
              to: expoPushToken,
              sound: 'default',
              title: notificationTitle,
              body: notificationBody,
              data: notificationData,
            }),
          });

          const pushResult = await pushResponse.json();

          // Handle device registration errors
          if (pushResult.data?.status === 'error') {
            const errorCode = pushResult.data?.details?.error;
            if (errorCode === 'DeviceNotRegistered') {
              // Mark token as disabled
              await supabase
                .from('push_tokens')
                .update({ enabled: false })
                .eq('expo_push_token', expoPushToken);
            }
          }

          results.push({
            recipientId,
            token: expoPushToken.substring(0, 20) + '...',
            success: pushResult.data?.status === 'ok',
            error: pushResult.data?.details?.error,
          });
        } catch (error) {
          results.push({
            recipientId,
            token: tokenRow.expo_push_token.substring(0, 20) + '...',
            success: false,
            error: error.message,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Notifications processed',
        notificationType,
        recipients: recipients.length,
        results,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing push notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

