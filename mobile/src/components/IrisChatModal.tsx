import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY, SPACING } from '../config/brand';
import {
  IRIS_NAME,
  IRIS_INPUT_PLACEHOLDER,
  IRIS_SEND_LABEL,
  IRIS_THINKING_LABEL,
  IRIS_ERROR_GENERIC,
  TOOL_BIO_DRAFT_USE,
  TOOL_BIO_DRAFT_DISMISS,
  TOOL_TIME_WINDOW_USE,
  TOOL_REPLY_DRAFT_USE,
} from '../lib/iris/persona';
import { streamIrisTurn, finalizeIris, IrisError } from '../lib/iris/client';
import type {
  IrisStreamEvent,
  IrisSurface,
  ProposeBioDraftInput,
  ProposeReplyDraftInput,
  ProposeTimeWindowInput,
} from '../lib/iris/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IrisChatModalProps {
  visible: boolean;
  onClose: () => void;
  surface: IrisSurface;
  matchId?: string;
  /** Greeting shown as the first assistant turn before the user types. */
  initialGreeting?: string;
  /** True for surfaces (interview) where leaving the modal should run the
   *  extraction pass. Default false — caller may also call finalize manually. */
  finalizeOnClose?: boolean;
  /** Tool result handlers — caller decides what to do with each draft. */
  onBioDraft?: (input: ProposeBioDraftInput) => void;
  onTimeWindow?: (input: ProposeTimeWindowInput) => void;
  onReplyDraft?: (input: ProposeReplyDraftInput) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolCalls?: { name: string; input: Record<string, unknown> }[];
  streaming?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IrisChatModal(props: IrisChatModalProps) {
  const { visible, onClose, surface, matchId, initialGreeting, finalizeOnClose } = props;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversationIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  // Reset on each open so leftover state from a previous session doesn't bleed in.
  useEffect(() => {
    if (visible) {
      setMessages(
        initialGreeting ? [{ id: 'greeting', role: 'assistant', text: initialGreeting }] : []
      );
      setInput('');
      setStreaming(false);
      setError(null);
      conversationIdRef.current = null;
    } else {
      // Cancel any in-flight stream when the modal closes
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [visible, initialGreeting]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setError(null);
    setInput('');

    // Append user turn + a placeholder assistant turn we'll stream into.
    const userId = `u-${Date.now()}`;
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', text },
      { id: assistantId, role: 'assistant', text: '', streaming: true },
    ]);

    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const stream = streamIrisTurn({
        surface,
        message: text,
        conversationId: conversationIdRef.current ?? undefined,
        matchId,
        signal: abortRef.current.signal,
      });

      for await (const event of stream as AsyncGenerator<IrisStreamEvent>) {
        if (event.type === 'text') {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + event.text } : m))
          );
        } else if (event.type === 'tool_use') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    toolCalls: [...(m.toolCalls ?? []), { name: event.name, input: event.input }],
                  }
                : m
            )
          );
        } else if (event.type === 'done') {
          conversationIdRef.current = event.conversationId || conversationIdRef.current;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
          );
        } else if (event.type === 'warning') {
          // Non-fatal; we continue. Surface in dev only.
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('Iris stream warning:', event.message);
          }
        }
      }
    } catch (err) {
      const message = err instanceof IrisError ? mapIrisError(err) : IRIS_ERROR_GENERIC;
      setError(message);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId || (m.text?.length ?? 0) > 0));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, surface, matchId]);

  const handleClose = useCallback(async () => {
    // If the surface wants finalize-on-close and we have a conversation,
    // run the extraction pass in the background. We don't block the close;
    // the user has already moved on.
    const cid = conversationIdRef.current;
    if (finalizeOnClose && cid) {
      finalizeIris(cid).catch((err) => {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('Iris finalize failed:', err);
        }
      });
    }
    abortRef.current?.abort();
    onClose();
  }, [finalizeOnClose, onClose]);

  // Auto-scroll on new content
  useEffect(() => {
    if (!scrollRef.current) return;
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>I</Text>
              </View>
              <Text style={styles.headerTitle}>{IRIS_NAME}</Text>
            </View>
            <Pressable onPress={handleClose} accessibilityRole="button" hitSlop={12}>
              <Text style={styles.headerClose}>Done</Text>
            </Pressable>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onBioDraft={props.onBioDraft}
                onTimeWindow={props.onTimeWindow}
                onReplyDraft={props.onReplyDraft}
                onUsedDraft={handleClose}
              />
            ))}
            {streaming && messages[messages.length - 1]?.role === 'user' && (
              <View style={styles.thinkingRow}>
                <ActivityIndicator size="small" color={BRAND_COLORS.aqua[400]} />
                <Text style={styles.thinkingText}>{IRIS_THINKING_LABEL}</Text>
              </View>
            )}
          </ScrollView>

          {/* Error */}
          {error && (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={IRIS_INPUT_PLACEHOLDER}
              placeholderTextColor={BRAND_COLORS.text[500]}
              style={styles.input}
              multiline
              editable={!streaming}
              onSubmitEditing={handleSend}
              blurOnSubmit
              returnKeyType="send"
            />
            <Pressable
              onPress={handleSend}
              disabled={streaming || input.trim().length === 0}
              style={[
                styles.sendButton,
                (streaming || input.trim().length === 0) && styles.sendButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={IRIS_SEND_LABEL}
            >
              <Text style={styles.sendText}>{IRIS_SEND_LABEL}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Message bubble + tool-result chips
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: ChatMessage;
  onBioDraft?: (input: ProposeBioDraftInput) => void;
  onTimeWindow?: (input: ProposeTimeWindowInput) => void;
  onReplyDraft?: (input: ProposeReplyDraftInput) => void;
  onUsedDraft: () => void;
}

function MessageBubble(props: MessageBubbleProps) {
  const { message, onBioDraft, onTimeWindow, onReplyDraft, onUsedDraft } = props;
  const isAssistant = message.role === 'assistant';

  return (
    <View style={[styles.bubble, isAssistant ? styles.bubbleAssistant : styles.bubbleUser]}>
      {message.text.length > 0 && (
        <Text
          style={[
            styles.bubbleText,
            isAssistant ? styles.bubbleTextAssistant : styles.bubbleTextUser,
          ]}
        >
          {message.text}
        </Text>
      )}
      {message.toolCalls?.map((tc, idx) => (
        <ToolCallCard
          key={`${tc.name}-${idx}`}
          name={tc.name}
          input={tc.input}
          onBioDraft={onBioDraft}
          onTimeWindow={onTimeWindow}
          onReplyDraft={onReplyDraft}
          onUsed={onUsedDraft}
        />
      ))}
    </View>
  );
}

interface ToolCallCardProps {
  name: string;
  input: Record<string, unknown>;
  onBioDraft?: (input: ProposeBioDraftInput) => void;
  onTimeWindow?: (input: ProposeTimeWindowInput) => void;
  onReplyDraft?: (input: ProposeReplyDraftInput) => void;
  onUsed: () => void;
}

function ToolCallCard(props: ToolCallCardProps) {
  const { name, input, onBioDraft, onTimeWindow, onReplyDraft, onUsed } = props;

  if (name === 'propose_bio_draft' && typeof input.bio === 'string') {
    const draft = input as unknown as ProposeBioDraftInput;
    return (
      <View style={styles.toolCard}>
        <Text style={styles.toolHeading}>Bio draft</Text>
        <Text style={styles.toolBody}>{draft.bio}</Text>
        <View style={styles.toolActions}>
          <Pressable
            style={styles.toolPrimary}
            onPress={() => {
              onBioDraft?.(draft);
              onUsed();
            }}
          >
            <Text style={styles.toolPrimaryText}>{TOOL_BIO_DRAFT_USE}</Text>
          </Pressable>
          <Text style={styles.toolDismiss}>{TOOL_BIO_DRAFT_DISMISS}</Text>
        </View>
      </View>
    );
  }

  if (name === 'propose_time_window' && typeof input.day === 'string') {
    const win = input as unknown as ProposeTimeWindowInput;
    return (
      <View style={styles.toolCard}>
        <Text style={styles.toolHeading}>{win.day}</Text>
        <Text style={styles.toolBody}>
          {win.start} – {win.end} · {win.date_type}
        </Text>
        <Pressable
          style={styles.toolPrimary}
          onPress={() => {
            onTimeWindow?.(win);
            onUsed();
          }}
        >
          <Text style={styles.toolPrimaryText}>{TOOL_TIME_WINDOW_USE}</Text>
        </Pressable>
      </View>
    );
  }

  if (name === 'propose_reply_draft' && Array.isArray(input.drafts)) {
    const drafts = input as unknown as ProposeReplyDraftInput;
    return (
      <View style={styles.toolCard}>
        <Text style={styles.toolHeading}>Reply ideas</Text>
        {drafts.drafts.map((d, idx) => (
          <Pressable
            key={idx}
            style={styles.replyDraftRow}
            onPress={() => {
              onReplyDraft?.({ drafts: [d] });
              onUsed();
            }}
          >
            <Text style={styles.replyDraftText}>{d.text}</Text>
            <Text style={styles.toolPrimaryText}>{TOOL_REPLY_DRAFT_USE}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapIrisError(err: IrisError): string {
  switch (err.message) {
    case 'not_entitled':
      return 'Your trial has ended. Subscribe to keep using Iris.';
    case 'rate_limited':
      return 'Slow down a moment — try again in a few minutes.';
    case 'no_session':
      return 'Sign in again to talk to Iris.';
    case 'invalid_surface':
    case 'empty_message':
    case 'message_too_long':
      return 'That message could not be sent. Try again.';
    default:
      return IRIS_ERROR_GENERIC;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: MIDNIGHT.bg,
    borderTopLeftRadius: MIDNIGHT.radius.lg,
    borderTopRightRadius: MIDNIGHT.radius.lg,
    height: '88%',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  avatarLetter: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
  },
  headerTitle: {
    color: BRAND_COLORS.text[900],
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  headerClose: {
    color: BRAND_COLORS.aqua[300],
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  messagesContent: {
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: MIDNIGHT.radius.md,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: MIDNIGHT.surface,
    borderWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: BRAND_COLORS.primary,
  },
  bubbleText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.normal,
  },
  bubbleTextAssistant: {
    color: BRAND_COLORS.text[700],
  },
  bubbleTextUser: {
    color: BRAND_COLORS.onPrimary,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  thinkingText: {
    color: BRAND_COLORS.text[600],
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  errorRow: {
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
  },
  errorText: {
    color: BRAND_COLORS.danger,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
    gap: SPACING.sm,
    backgroundColor: MIDNIGHT.surface,
  },
  input: {
    flex: 1,
    color: BRAND_COLORS.text[900],
    backgroundColor: MIDNIGHT.inputBg,
    borderRadius: MIDNIGHT.radius.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    minHeight: 40,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    borderRadius: MIDNIGHT.radius.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  toolCard: {
    marginTop: SPACING.sm,
    backgroundColor: MIDNIGHT.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.aqua[600],
    borderRadius: MIDNIGHT.radius.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  toolHeading: {
    color: BRAND_COLORS.aqua[300],
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  toolBody: {
    color: BRAND_COLORS.text[900],
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
  },
  toolActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  toolPrimary: {
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: MIDNIGHT.radius.sm,
  },
  toolPrimaryText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  toolDismiss: {
    color: BRAND_COLORS.text[600],
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  replyDraftRow: {
    backgroundColor: MIDNIGHT.inputBg,
    borderRadius: MIDNIGHT.radius.sm,
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  replyDraftText: {
    flex: 1,
    color: BRAND_COLORS.text[900],
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
});
