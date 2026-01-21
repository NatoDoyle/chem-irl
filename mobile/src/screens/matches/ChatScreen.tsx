import { useState, useEffect, useRef, useCallback } from 'react';
import { createThrottle } from '../../lib/throttle';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  AppState,
} from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase/client';
import { Message } from '../../lib/types';
import { BRAND_COLORS } from '../../config/brand';
import { getErrorAlert, isRecoverableError } from '../../lib/errors';
import { enqueue, processQueue, getQueueSize, QueuedMessage } from '../../lib/offlineQueue';
import ConnectionStatus from '../../components/ConnectionStatus';
import { sanitizeText } from '../../lib/sanitize';
import { addBreadcrumb } from '../../lib/sentry';
import { trackEvent } from '../../lib/analytics';

type ChatRouteParams = {
  matchId: string;
};

export default function ChatScreen() {
  const route = useRoute();
  const { matchId } = route.params as ChatRouteParams;
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [queuedMessages, setQueuedMessages] = useState<Map<string, QueuedMessage>>(new Map());
  // Throttle message sending to prevent spam (min 500ms between messages)
  const sendThrottleRef = useRef(createThrottle(() => {}, 500));
  // Typing indicator state
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // Mark messages as read
  const markMessagesRead = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      // Call RPC to mark messages as read
      await supabase.rpc('mark_messages_read', {
        p_match_id: matchId,
      });
    } catch (error) {
      // Silently fail - read receipts are nice-to-have
      console.error('Error marking messages as read:', error);
    }
  }, [matchId]);

  const loadMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        const { title, message } = getErrorAlert(error, 'Failed to load messages');
        Alert.alert(title, message);
        return;
      }

      setMessages((data as Message[]) || []);

      // Mark messages as read after loading
      await markMessagesRead();
    } catch (error: any) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId, markMessagesRead]);

  const subscribeToMessages = useCallback(async () => {
    // Get current user ID for typing indicator
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      currentUserIdRef.current = user.id;
    }

    // Subscribe to message changes (INSERT and UPDATE for read_at)
    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((msg) => msg.message_id === newMessage.message_id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
          // Mark as read and scroll to bottom
          markMessagesRead();
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          // Update read_at for messages
          const updatedMessage = payload.new as Message;
          setMessages((prev) =>
            prev.map((msg) => (msg.message_id === updatedMessage.message_id ? updatedMessage : msg))
          );
        }
      )
      .subscribe();

    // Subscribe to typing indicators using presence
    if (user) {
      const typingChannel = supabase.channel(`typing:${matchId}`, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      // Track local typing state
      typingChannel
        .on('presence', { event: 'sync' }, () => {
          const state = typingChannel.presenceState();
          // Check if other user is typing (any presence entry that's not current user)
          let otherUserTyping = false;
          Object.keys(state).forEach((key) => {
            if (key !== user.id) {
              const presences = state[key] as { typing?: boolean }[];
              if (presences.some((p) => p.typing === true)) {
                otherUserTyping = true;
              }
            }
          });
          setIsOtherUserTyping(otherUserTyping);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          // Another user joined - check if they're typing
          if (key !== user.id) {
            const isTyping = newPresences.some((p: any) => p.typing === true);
            if (isTyping) {
              setIsOtherUserTyping(true);
            }
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          // User left - stop showing typing indicator if it was them
          if (key !== user.id) {
            setIsOtherUserTyping(false);
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // Set initial presence (not typing)
            await typingChannel.track({
              typing: false,
              userId: user.id,
            });
          }
        });

      typingChannelRef.current = typingChannel;
    }

    return () => {
      supabase.removeChannel(channel);
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
    };
  }, [matchId, markMessagesRead]);

  // Load queue size on mount and after processing
  const updateQueueSize = useCallback(async () => {
    const size = await getQueueSize();
    setQueueSize(size);

    // Load queued messages for this match to show optimistically
    const { loadQueue } = await import('../../lib/offlineQueue');
    const queue = await loadQueue();
    const matchQueue = queue.filter(
      (op): op is QueuedMessage => op.type === 'message' && op.match_id === matchId
    );
    const queueMap = new Map(matchQueue.map((msg) => [msg.id, msg]));
    setQueuedMessages(queueMap);
  }, [matchId]);

  // Process queue when network is available (after successful operations)
  const processQueueIfNeeded = useCallback(async () => {
    try {
      const processed = await processQueue();
      if (processed > 0) {
        // Reload messages to show newly sent ones
        await loadMessages();
        await updateQueueSize();
      }
    } catch (error) {
      console.error('Error processing queue:', error);
    }
  }, [loadMessages, updateQueueSize]);

  useEffect(() => {
    loadMessages();
    updateQueueSize();
    let unsubscribe: (() => void) | null = null;

    subscribeToMessages().then((cleanup) => {
      unsubscribe = cleanup;
    });

    // Cleanup typing timeout on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [loadMessages, subscribeToMessages, updateQueueSize, markMessagesRead]);

  // Mark messages as read when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      markMessagesRead();
    }, [markMessagesRead])
  );

  // Re-subscribe to realtime when app comes to foreground
  // This ensures we catch messages that may have been missed while backgrounded
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // App came to foreground - reload messages to catch any missed events
        loadMessages();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [loadMessages]);

  // Track typing state and broadcast to presence channel
  const handleTypingChange = useCallback((text: string) => {
    setNewMessage(text);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // If user is typing, broadcast typing state
    if (text.trim().length > 0 && typingChannelRef.current) {
      typingChannelRef.current.track({
        typing: true,
        userId: currentUserIdRef.current,
      });

      // Stop typing indicator after 3 seconds of no input
      typingTimeoutRef.current = setTimeout(() => {
        if (typingChannelRef.current) {
          typingChannelRef.current.track({
            typing: false,
            userId: currentUserIdRef.current,
          });
        }
      }, 3000);
    } else if (typingChannelRef.current) {
      // User cleared input - stop typing indicator
      typingChannelRef.current.track({
        typing: false,
        userId: currentUserIdRef.current,
      });
    }
  }, []);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    // Stop typing indicator when sending
    if (typingChannelRef.current) {
      typingChannelRef.current.track({
        typing: false,
        userId: currentUserIdRef.current,
      });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    // Prevent rapid successive messages (rate limiting)
    if (sendThrottleRef.current.isThrottled()) {
      return;
    }

    // Update throttle to prevent next call for 500ms
    sendThrottleRef.current.execute();

    // Sanitize message content before storing
    const messageContent = sanitizeText(newMessage.trim());
    setNewMessage('');
    setSending(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSending(false);
        return;
      }

      addBreadcrumb('Sending message', 'chat', 'info', {
        matchId: matchId.substring(0, 8),
        messageLength: messageContent.length,
      });
      trackEvent('message_sent', {
        matchId: matchId.substring(0, 8),
        messageLength: messageContent.length,
      });

      const { error } = await supabase.from('messages').insert({
        match_id: matchId,
        sender_id: user.id,
        content: messageContent,
        bytes: new Blob([messageContent]).size,
      });

      if (error) {
        // Check if it's a recoverable (network) error
        if (isRecoverableError(error)) {
          // Queue message for retry
          const queuedMessage: QueuedMessage = {
            id: `${Date.now()}-${Math.random()}`,
            type: 'message',
            match_id: matchId,
            sender_id: user.id,
            content: messageContent,
            bytes: new Blob([messageContent]).size,
            createdAt: new Date().toISOString(),
          };
          await enqueue(queuedMessage);
          setQueuedMessages((prev) => new Map(prev).set(queuedMessage.id, queuedMessage));
          await updateQueueSize();
          // Show optimistic message in UI
          Alert.alert('Message queued', "Your message will be sent when you're back online.");
        } else {
          // Non-recoverable error
          const { title, message } = getErrorAlert(error, 'Failed to send message');
          Alert.alert(title, message);
          setNewMessage(messageContent); // Restore message on error
        }
      } else {
        // Success - process any queued messages
        await processQueueIfNeeded();
      }
    } catch (error: any) {
      // Check if it's a recoverable (network) error
      if (isRecoverableError(error)) {
        // Queue message for retry
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const queuedMessage: QueuedMessage = {
            id: `${Date.now()}-${Math.random()}`,
            type: 'message',
            match_id: matchId,
            sender_id: user.id,
            content: messageContent,
            bytes: new Blob([messageContent]).size,
            createdAt: new Date().toISOString(),
          };
          await enqueue(queuedMessage);
          setQueuedMessages((prev) => new Map(prev).set(queuedMessage.id, queuedMessage));
          await updateQueueSize();
          Alert.alert('Message queued', "Your message will be sent when you're back online.");
        } else {
          setNewMessage(messageContent);
        }
      } else {
        const { title, message } = getErrorAlert(error, 'Failed to send message');
        Alert.alert(title, message);
        setNewMessage(messageContent);
      }
    } finally {
      setSending(false);
    }
  };

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
      currentUserIdRef.current = user?.id || null;
    });
  }, []);

  // Merge queued messages with regular messages for display
  const allMessages = [...messages];
  queuedMessages.forEach((queuedMsg) => {
    // Add queued messages that aren't already in the messages list
    const exists = messages.some((msg) => {
      // Check if this queued message matches a regular message
      return (
        msg.sender_id === queuedMsg.sender_id &&
        msg.content === queuedMsg.content &&
        msg.match_id === queuedMsg.match_id
      );
    });
    if (!exists && currentUserId === queuedMsg.sender_id) {
      // Create a temporary message object for display
      allMessages.push({
        message_id: queuedMsg.id,
        match_id: queuedMsg.match_id,
        sender_id: queuedMsg.sender_id,
        content: queuedMsg.content,
        bytes: queuedMsg.bytes,
        created_at: queuedMsg.createdAt,
      } as Message);
    }
  });
  // Sort by created_at
  allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const renderMessage = ({ item }: { item: Message }) => {
    if (!currentUserId) return null;
    const isOwn = item.sender_id === currentUserId;
    const isQueued = queuedMessages.has(item.message_id);

    // Find the last outgoing message to show read receipt
    const allOutgoing = allMessages
      .filter((msg) => msg.sender_id === currentUserId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const lastOutgoingMessage = allOutgoing[0] || null;
    const showReadReceipt =
      isOwn && item.message_id === lastOutgoingMessage?.message_id && item.read_at;

    return (
      <View style={[styles.messageContainer, isOwn ? styles.ownMessage : styles.otherMessage]}>
        <Text style={[styles.messageText, isOwn ? styles.ownMessageText : styles.otherMessageText]}>
          {item.content}
        </Text>
        {isQueued && <Text style={styles.queuedIndicator}>Queued (will send when online)</Text>}
        <View style={styles.messageFooter}>
          <Text style={styles.messageTime}>
            {new Date(item.created_at).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
          {showReadReceipt && (
            <Text style={styles.readReceipt}>
              Seen{' '}
              {item.read_at
                ? new Date(item.read_at).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : ''}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <ConnectionStatus />
      {messages.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>Start the conversation!</Text>
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={allMessages}
            keyExtractor={(item) => item.message_id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
          {/* Typing indicator */}
          {isOtherUserTyping && (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>Typing...</Text>
            </View>
          )}
        </>
      )}
      {queueSize > 0 && (
        <View style={styles.queueBanner}>
          <Text style={styles.queueText}>
            {queueSize} message{queueSize > 1 ? 's' : ''} queued - will send when online
          </Text>
        </View>
      )}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={BRAND_COLORS.text[600]}
            value={newMessage}
            onChangeText={handleTypingChange}
            multiline
            maxLength={500}
            editable={!sending}
          />
          <Text style={styles.characterCount}>{newMessage.length}/500</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!newMessage.trim() || sending || newMessage.length >= 500) &&
              styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!newMessage.trim() || sending || newMessage.length >= 500}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_COLORS.surface,
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    maxWidth: '75%',
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: BRAND_COLORS.primary,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  ownMessageText: {
    color: BRAND_COLORS.onPrimary,
  },
  otherMessageText: {
    color: BRAND_COLORS.text[900],
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  messageTime: {
    fontSize: 12,
    opacity: 0.7,
    color: BRAND_COLORS.text[600],
  },
  readReceipt: {
    fontSize: 11,
    opacity: 0.6,
    color: BRAND_COLORS.text[600],
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'flex-end',
  },
  inputWrapper: {
    flex: 1,
    marginRight: 8,
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 60,
    fontSize: 16,
    maxHeight: 100,
  },
  characterCount: {
    position: 'absolute',
    bottom: 8,
    right: 16,
    fontSize: 12,
    color: BRAND_COLORS.text[600],
  },
  sendButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
  },
  queueBanner: {
    backgroundColor: BRAND_COLORS.warning + '20',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: BRAND_COLORS.warning,
  },
  queueText: {
    fontSize: 12,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
  },
  queuedIndicator: {
    fontSize: 10,
    fontStyle: 'italic',
    color: BRAND_COLORS.text[600],
    marginTop: 4,
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: BRAND_COLORS.background[50],
  },
  typingText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: BRAND_COLORS.text[600],
  },
});
