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
import { useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase/client';
import { Message } from '../../lib/types';
import { BRAND_COLORS } from '../../config/brand';
import { getErrorAlert, isRecoverableError } from '../../lib/errors';
import { enqueue, processQueue, getQueueSize, QueuedMessage } from '../../lib/offlineQueue';
import ConnectionStatus from '../../components/ConnectionStatus';

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
    } catch (error: any) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  const subscribeToMessages = useCallback(() => {
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
          setMessages((prev) => [...prev, newMessage]);
          // Scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

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
    const unsubscribe = subscribeToMessages();
    return unsubscribe;
  }, [loadMessages, subscribeToMessages, updateQueueSize]);

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

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    // Prevent rapid successive messages (rate limiting)
    if (sendThrottleRef.current.isThrottled()) {
      return;
    }

    // Update throttle to prevent next call for 500ms
    sendThrottleRef.current.execute();

    const messageContent = newMessage.trim();
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

    return (
      <View style={[styles.messageContainer, isOwn ? styles.ownMessage : styles.otherMessage]}>
        <Text style={[styles.messageText, isOwn ? styles.ownMessageText : styles.otherMessageText]}>
          {item.content}
        </Text>
        {isQueued && <Text style={styles.queuedIndicator}>Queued (will send when online)</Text>}
        <Text style={styles.messageTime}>
          {new Date(item.created_at).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
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
        <FlatList
          ref={flatListRef}
          data={allMessages}
          keyExtractor={(item) => item.message_id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
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
            onChangeText={setNewMessage}
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
    backgroundColor: '#fff',
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
    color: '#fff',
  },
  otherMessageText: {
    color: BRAND_COLORS.text[900],
  },
  messageTime: {
    fontSize: 12,
    opacity: 0.7,
    color: BRAND_COLORS.text[600],
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#fff',
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
    color: '#fff',
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
});
