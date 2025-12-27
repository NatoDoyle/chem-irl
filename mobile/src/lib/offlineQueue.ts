/**
 * Offline queue for storing pending operations (messages, proposals)
 * and retrying them when network is restored.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase/client';
import { isRecoverableError } from './errors';

const QUEUE_STORAGE_KEY = '@chemirl:offline_queue';

export interface QueuedMessage {
  id: string;
  type: 'message';
  match_id: string;
  sender_id: string;
  content: string;
  bytes: number;
  createdAt: string;
}

export interface QueuedProposal {
  id: string;
  type: 'proposal';
  match_id: string;
  sender_id: string;
  windows: { start: string; end: string }[];
  date_types: string[];
  note: string | null;
  expires_at: string;
  createdAt: string;
}

export type QueuedOperation = QueuedMessage | QueuedProposal;

/**
 * Load queued operations from storage
 */
export async function loadQueue(): Promise<QueuedOperation[]> {
  try {
    const data = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as QueuedOperation[];
  } catch (error) {
    console.error('Error loading queue:', error);
    return [];
  }
}

/**
 * Save queued operations to storage
 */
async function saveQueue(queue: QueuedOperation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Error saving queue:', error);
  }
}

/**
 * Add operation to queue
 */
export async function enqueue(operation: QueuedOperation): Promise<void> {
  const queue = await loadQueue();
  queue.push(operation);
  await saveQueue(queue);
}

/**
 * Remove operation from queue by ID
 */
export async function dequeue(id: string): Promise<void> {
  const queue = await loadQueue();
  const filtered = queue.filter((op) => op.id !== id);
  await saveQueue(filtered);
}

/**
 * Process a single queued message
 */
async function processMessage(message: QueuedMessage): Promise<boolean> {
  try {
    const { error } = await supabase.from('messages').insert({
      match_id: message.match_id,
      sender_id: message.sender_id,
      content: message.content,
      bytes: message.bytes,
    });

    if (error) {
      // If still a recoverable error, keep in queue
      if (isRecoverableError(error)) {
        return false;
      }
      // Non-recoverable error - remove from queue
      await dequeue(message.id);
      console.error('Failed to send queued message (non-recoverable):', error);
      return false;
    }

    // Success - remove from queue
    await dequeue(message.id);
    return true;
  } catch (error) {
    // Network or other recoverable error
    if (isRecoverableError(error)) {
      return false;
    }
    // Non-recoverable - remove from queue
    await dequeue(message.id);
    console.error('Failed to send queued message (non-recoverable):', error);
    return false;
  }
}

/**
 * Process a single queued proposal
 */
async function processProposal(proposal: QueuedProposal): Promise<boolean> {
  try {
    const { error } = await supabase.from('proposals').insert({
      match_id: proposal.match_id,
      sender_id: proposal.sender_id,
      windows: proposal.windows,
      date_types: proposal.date_types,
      note: proposal.note,
      expires_at: proposal.expires_at,
      status: 'active',
    });

    if (error) {
      // If still a recoverable error, keep in queue
      if (isRecoverableError(error)) {
        return false;
      }
      // Non-recoverable error - remove from queue
      await dequeue(proposal.id);
      console.error('Failed to send queued proposal (non-recoverable):', error);
      return false;
    }

    // Success - remove from queue
    await dequeue(proposal.id);
    return true;
  } catch (error) {
    // Network or other recoverable error
    if (isRecoverableError(error)) {
      return false;
    }
    // Non-recoverable - remove from queue
    await dequeue(proposal.id);
    console.error('Failed to send queued proposal (non-recoverable):', error);
    return false;
  }
}

/**
 * Process all queued operations
 * Returns number of operations successfully processed
 */
export async function processQueue(): Promise<number> {
  const queue = await loadQueue();
  if (queue.length === 0) return 0;

  let processed = 0;
  for (const operation of queue) {
    let success = false;
    if (operation.type === 'message') {
      success = await processMessage(operation);
    } else if (operation.type === 'proposal') {
      success = await processProposal(operation);
    }

    if (success) {
      processed++;
    }

    // Small delay between operations to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return processed;
}

/**
 * Get queue size
 */
export async function getQueueSize(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}

/**
 * Clear all queued operations
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
}
