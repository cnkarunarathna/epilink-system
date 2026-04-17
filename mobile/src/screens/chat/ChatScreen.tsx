/**
 * ChatScreen — task-scoped real-time messaging for PHIs
 *
 * Layout:
 *   Header (task title + back)
 *   FlatList (message bubbles, newest at bottom)
 *   Typing indicator slot
 *   MessageInput (TextInput + send button)
 *
 * Delivery: REST polling every 8 s while the screen is focused.
 * The backend also supports Socket.io; upgrade path is to swap the
 * polling interval for a socket event listener when the mobile client
 * adds socket.io-client.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  RouteProp,
  useFocusEffect,
} from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { TaskStackParamList } from "../../navigation/types";
import { chatService, ChatMessage } from "../../api/chatService";
import { useAuth } from "../../context/AuthContext";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../theme";
import { formatRelativeTime } from "../../utils/dateFormatter";

type ChatRouteProp = RouteProp<TaskStackParamList, "Chat">;

const POLL_INTERVAL_MS = 8000;
const MAX_MESSAGE_LENGTH = 2000;

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showSenderName: boolean;
}

const MessageBubble: React.FC<BubbleProps> = ({
  message,
  isOwn,
  showSenderName,
}) => {
  if (message.isSystemMessage) {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bubbleRow,
        isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther,
      ]}
    >
      {/* Avatar placeholder (initials) */}
      {!isOwn && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {message.sender.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.bubbleWrap,
          isOwn ? styles.bubbleWrapOwn : styles.bubbleWrapOther,
        ]}
      >
        {showSenderName && !isOwn && (
          <Text style={styles.senderName}>{message.sender.name}</Text>
        )}

        {isOwn ? (
          <LinearGradient
            colors={colors.gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.bubble, styles.bubbleOwn]}
          >
            <Text style={styles.bubbleTextOwn}>{message.content}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.bubbleOther]}>
            <Text style={styles.bubbleTextOther}>{message.content}</Text>
          </View>
        )}

        <View style={[styles.bubbleMeta, isOwn && styles.bubbleMetaOwn]}>
          <Text style={styles.timestamp}>
            {formatRelativeTime(message.createdAt)}
          </Text>
          {isOwn && (
            <MaterialCommunityIcons
              name={
                message.pending
                  ? "clock-outline"
                  : message.failed
                    ? "alert-circle-outline"
                    : message.readBy.length > 1
                      ? "check-all"
                      : "check"
              }
              size={13}
              color={
                message.failed
                  ? colors.destructive
                  : message.readBy.length > 1
                    ? colors.primary
                    : colors.textSecondary
              }
            />
          )}
        </View>
      </View>
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

export const ChatScreen: React.FC = () => {
  const route = useRoute<ChatRouteProp>();
  const navigation = useNavigation();
  const { taskId, taskTitle, isReadOnly } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestMessageIdRef = useRef<string | null>(null);
  const mountAnim = useRef(new Animated.Value(0)).current;

  // ── Data fetching ────────────────────────────────────────────────────────

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      setError(null);
      try {
        // Server returns messages in chronological order (oldest → newest)
        const data = await chatService.getMessages(taskId, { limit: 50 });
        setMessages(data);
        setHasMore(data.length === 50);

        if (data.length > 0) {
          latestMessageIdRef.current = data[data.length - 1].id;
        }

        // Mark unread messages as read
        const unreadIds = data
          .filter(
            (m) =>
              m.sender.id !== user?.id &&
              !m.readBy.some((r) => r.userId === user?.id),
          )
          .map((m) => m.id);
        if (unreadIds.length > 0) {
          chatService.markRead(taskId, unreadIds).catch(() => {});
        }
      } catch (err: any) {
        if (!silent) setError(err?.message || "Failed to load messages");
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [taskId, user?.id],
  );

  const pollForNew = useCallback(async () => {
    try {
      // Server returns chronological order (oldest → newest)
      const data = await chatService.getMessages(taskId, { limit: 20 });
      if (data.length === 0) return;

      const latest = data[data.length - 1];
      if (latest.id === latestMessageIdRef.current) return;

      // Merge in new messages that aren't already displayed
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes = data.filter((m) => !existingIds.has(m.id));
        if (newOnes.length === 0) return prev;

        latestMessageIdRef.current = latest.id;

        // Mark new messages from others as read
        const toRead = newOnes
          .filter((m) => m.sender.id !== user?.id)
          .map((m) => m.id);
        if (toRead.length > 0) {
          chatService.markRead(taskId, toRead).catch(() => {});
        }

        return [...prev, ...newOnes];
      });
    } catch {
      // Silently swallow poll errors
    }
  }, [taskId, user?.id]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    loadMessages(false).then(() => {
      Animated.spring(mountAnim, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }).start();
    });
  }, [loadMessages, mountAnim]);

  // Poll only while the screen is focused
  useFocusEffect(
    useCallback(() => {
      pollRef.current = setInterval(pollForNew, POLL_INTERVAL_MS);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [pollForNew]),
  );

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [messages.length, isLoading]);

  // ── Load more (older messages) ─────────────────────────────────────────────

  const loadMore = async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return;
    setIsLoadingMore(true);
    try {
      const oldest = messages[0];
      const older = await chatService.getMessages(taskId, {
        limit: 50,
        before: oldest.id,
      });
      if (older.length === 0) {
        setHasMore(false);
        return;
      }
      // Server already returns chronological order; prepend older messages
      setMessages((prev) => [...older, ...prev]);
      setHasMore(older.length === 50);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to load older messages");
    } finally {
      setIsLoadingMore(false);
    }
  };

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      taskId,
      content: text,
      sender: {
        id: user?.id ?? "",
        name: user?.name ?? "You",
        role: user?.role ?? "",
      },
      isSystemMessage: false,
      createdAt: new Date().toISOString(),
      readBy: [],
      pending: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setInputText("");
    setIsSending(true);

    try {
      const sent = await chatService.sendMessage(taskId, { content: text });
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...sent } : m)),
      );
      latestMessageIdRef.current = sent.id;
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, pending: false, failed: true } : m,
        ),
      );
      Alert.alert("Send failed", err?.message || "Could not send message");
    } finally {
      setIsSending(false);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderMessage = ({
    item,
    index,
  }: {
    item: ChatMessage;
    index: number;
  }) => {
    const isOwn = item.sender.id === user?.id;
    const prevMsg = messages[index - 1];
    const showSenderName =
      !isOwn &&
      (!prevMsg ||
        prevMsg.sender.id !== item.sender.id ||
        prevMsg.isSystemMessage);

    return (
      <MessageBubble
        message={item}
        isOwn={isOwn}
        showSenderName={showSenderName}
      />
    );
  };

  const renderHeader = () =>
    isLoadingMore ? (
      <View style={styles.loadMoreRow}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    ) : hasMore ? (
      <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore}>
        <Text style={styles.loadMoreText}>Load older messages</Text>
      </TouchableOpacity>
    ) : null;

  const renderEmpty = () =>
    isLoading ? null : (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="chat-outline"
          size={56}
          color={colors.border}
        />
        <Text style={styles.emptyTitle}>No messages yet</Text>
        <Text style={styles.emptySubtitle}>Start the conversation below</Text>
      </View>
    );

  const canSend =
    !isReadOnly &&
    inputText.trim().length > 0 &&
    inputText.length <= MAX_MESSAGE_LENGTH;
  const bottomMenuClearance = insets.bottom + spacing.sm;
  const listBottomPadding = isReadOnly
    ? bottomMenuClearance + spacing.md
    : spacing.md + spacing.xs;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {/* ── Header ── */}
      <LinearGradient
        colors={colors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.primaryForeground}
          />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <MaterialCommunityIcons
            name="chat-processing"
            size={20}
            color={colors.primaryForeground}
            style={{ marginRight: spacing.xs }}
          />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {taskTitle}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => loadMessages(false)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name="refresh"
            size={22}
            color={colors.primaryForeground}
          />
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Body ── */}
      <Animated.View
        style={[
          styles.body,
          {
            opacity: mountAnim,
            transform: [
              {
                translateY: mountAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          },
        ]}
      >
        {/* Error banner */}
        {error && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={16}
              color={colors.destructive}
            />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => loadMessages(false)}>
              <Text style={styles.errorRetry}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Read-only banner */}
        {isReadOnly && (
          <View style={styles.readOnlyBanner}>
            <MaterialCommunityIcons
              name="lock-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={styles.readOnlyText}>
              This task is closed. Chat is read-only.
            </Text>
          </View>
        )}

        {/* Messages */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading messages…</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: listBottomPadding },
              messages.length === 0 && styles.listContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            onScrollToIndexFailed={() => {}}
          />
        )}
      </Animated.View>

      {/* ── Input ── */}
      {!isReadOnly && (
        <View
          style={[
            styles.inputBar,
            shadows.md,
            { marginBottom: bottomMenuClearance },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              inputText.length > MAX_MESSAGE_LENGTH && styles.inputError,
            ]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message…"
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={MAX_MESSAGE_LENGTH + 50} // allow over-limit so counter shows
            returnKeyType="default"
          />

          {/* Character counter shown near limit */}
          {inputText.length > MAX_MESSAGE_LENGTH - 200 && (
            <Text
              style={[
                styles.charCount,
                inputText.length > MAX_MESSAGE_LENGTH && styles.charCountError,
              ]}
            >
              {MAX_MESSAGE_LENGTH - inputText.length}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!canSend}
          >
            {isSending ? (
              <ActivityIndicator
                size="small"
                color={colors.primaryForeground}
              />
            ) : (
              <LinearGradient
                colors={
                  canSend
                    ? colors.gradient.primary
                    : [colors.muted, colors.muted]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendGradient}
              >
                <MaterialCommunityIcons
                  name="send"
                  size={20}
                  color={
                    canSend ? colors.primaryForeground : colors.textSecondary
                  }
                />
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.muted,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primaryForeground,
  },
  refreshBtn: {
    padding: spacing.xs,
  },
  // Body
  body: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  // Banners
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.destructive + "10",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.destructive,
  },
  errorRetry: {
    fontSize: typography.fontSize.sm,
    color: colors.destructive,
    fontWeight: typography.fontWeight.semibold,
    textDecorationLine: "underline",
  },
  readOnlyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  readOnlyText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  // List
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: "center",
  },
  loadMoreRow: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  loadMoreBtn: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  loadMoreText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  // Empty state
  emptyContainer: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  // Bubbles
  bubbleRow: {
    flexDirection: "row",
    marginVertical: spacing.xs / 2,
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  bubbleRowOwn: {
    justifyContent: "flex-end",
  },
  bubbleRowOther: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryDark,
  },
  bubbleWrap: {
    maxWidth: "75%",
  },
  bubbleWrapOwn: {
    alignItems: "flex-end",
  },
  bubbleWrapOther: {
    alignItems: "flex-start",
  },
  senderName: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    marginBottom: 2,
    marginLeft: spacing.sm,
  },
  bubble: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius["2xl"],
  },
  bubbleOwn: {
    borderBottomRightRadius: borderRadius.sm,
  },
  bubbleOther: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleTextOwn: {
    fontSize: typography.fontSize.base,
    color: colors.primaryForeground,
    lineHeight: 22,
  },
  bubbleTextOther: {
    fontSize: typography.fontSize.base,
    color: colors.text,
    lineHeight: 22,
  },
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
    marginLeft: spacing.sm,
  },
  bubbleMetaOwn: {
    justifyContent: "flex-end",
    marginLeft: 0,
    marginRight: spacing.xs,
  },
  timestamp: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  // System message
  systemRow: {
    alignItems: "center",
    marginVertical: spacing.sm,
  },
  systemText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontStyle: "italic",
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    textAlign: "center",
  },
  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius["3xl"],
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text,
    backgroundColor: colors.muted,
    borderRadius: borderRadius["2xl"],
    borderWidth: 1,
    borderColor: colors.border,
    lineHeight: 22,
  },
  inputError: {
    borderColor: colors.destructive,
  },
  charCount: {
    position: "absolute",
    right: 68,
    bottom: 16,
    fontSize: 10,
    color: colors.textSecondary,
  },
  charCountError: {
    color: colors.destructive,
    fontWeight: typography.fontWeight.semibold,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: "hidden",
    flexShrink: 0,
    marginBottom: 2,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
