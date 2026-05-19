import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import TopBar from '../src/components/TopBar';
import Ic from '../src/components/Ic';
import { M } from '../src/theme';
import {
  approveConversationAction,
  getConversation,
  rejectConversationAction,
  sendConversationMessage,
} from '../src/api';
import { subscribeToBooking, subscribeToConversation } from '../src/realtime';

function upsertById(items, item, idField) {
  if (!item?.[idField]) return items;
  const exists = items.some((current) => current[idField] === item[idField]);
  if (!exists) return [...items, item];
  return items.map((current) => (current[idField] === item[idField] ? { ...current, ...item } : current));
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatSlot(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusTone(status) {
  if (status === 'confirmed') {
    return { label: 'Provider accepted', color: M.success, bg: M.successBg };
  }
  if (status === 'cancelled') {
    return { label: 'Cancelled', color: M.error, bg: '#FEF2F2' };
  }
  if (status === 'rejected') {
    return { label: 'Provider declined', color: M.error, bg: '#FEF2F2' };
  }
  if (status === 'pending_provider_response') {
    return { label: 'Waiting for provider', color: M.amber, bg: M.amberBg };
  }
  return { label: 'Draft booking', color: M.textMute, bg: M.surfaceVar };
}

function isInitialProviderDecisionMessage(message) {
  return message.senderType === 'provider' &&
    ['accepted', 'rejected'].includes(message.metadata?.parsedIntent) &&
    /^(accept|accepted|yes|reject|rejected|no)$/i.test(String(message.body || '').trim());
}

function SectionLabel({ children }) {
  return (
    <Text style={{
      fontSize: 11,
      fontWeight: '900',
      color: M.textDim,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: 8,
      marginTop: 4,
    }}>
      {children}
    </Text>
  );
}

function BookingSummaryCard({ booking, providerName }) {
  const tone = statusTone(booking?.status);
  return (
    <View style={{
      backgroundColor: M.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: M.border,
      padding: 14,
      marginBottom: 12,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <View style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          backgroundColor: M.accentBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ic name="shield" size={17} color={M.accentDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: M.textDim, fontWeight: '800' }}>Provider</Text>
          <Text style={{ fontSize: 16, color: M.text, fontWeight: '900', marginTop: 1 }}>
            {providerName || booking?.providerName || 'Provider'}
          </Text>
        </View>
        <View style={{
          backgroundColor: tone.bg,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 6,
        }}>
          <Text style={{ fontSize: 11, color: tone.color, fontWeight: '900' }}>
            {tone.label}
          </Text>
        </View>
      </View>

      {[
        { icon: 'flow', label: 'Booking', value: booking?.bookingId || 'Not available' },
        { icon: 'wrench', label: 'Service', value: booking?.serviceType || 'Service' },
        { icon: 'cal', label: 'Visit time', value: booking?.slotLabel || formatSlot(booking?.slot) },
        { icon: 'pin', label: 'Area', value: booking?.location || 'Location not set' },
      ].map((row, index) => (
        <View
          key={row.label}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingTop: index === 0 ? 0 : 10,
            marginTop: index === 0 ? 0 : 10,
            borderTopWidth: index === 0 ? 0 : 1,
            borderTopColor: M.divider,
          }}
        >
          <Ic name={row.icon} size={14} color={M.textDim} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: M.textDim, fontWeight: '700' }}>{row.label}</Text>
            <Text style={{ fontSize: 13, color: M.text, fontWeight: '800', marginTop: 1 }}>{row.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function bubbleStyle(senderType) {
  if (senderType === 'user') {
    return {
      alignSelf: 'flex-end',
      backgroundColor: M.text,
      textColor: '#FFFFFF',
      metaColor: '#CBD5E1',
      label: 'You',
    };
  }
  if (senderType === 'provider') {
    return {
      alignSelf: 'flex-start',
      backgroundColor: M.surface,
      textColor: M.text,
      metaColor: M.textDim,
      label: 'Provider',
    };
  }
  if (senderType === 'assistant') {
    return {
      alignSelf: 'center',
      backgroundColor: M.agentBg,
      textColor: M.text,
      metaColor: M.agent,
      label: 'AI handover',
    };
  }
  return {
    alignSelf: 'center',
    backgroundColor: M.surfaceVar,
    textColor: M.textMute,
    metaColor: M.textDim,
    label: 'System',
  };
}

function MessageBubble({ message }) {
  const tone = bubbleStyle(message.senderType);
  return (
    <View
      style={{
        maxWidth: message.senderType === 'user' || message.senderType === 'provider' ? '82%' : '94%',
        alignSelf: tone.alignSelf,
        backgroundColor: tone.backgroundColor,
        borderRadius: 14,
        borderWidth: message.senderType === 'provider' ? 1 : 0,
        borderColor: M.border,
        paddingHorizontal: 13,
        paddingVertical: 10,
        marginBottom: 9,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '800', color: tone.metaColor, marginBottom: 4 }}>
        {tone.label}{message.status === 'failed' ? ' · failed' : ''}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 20, color: tone.textColor, fontWeight: '600' }}>
        {message.body}
      </Text>
      <Text style={{ fontSize: 10, color: tone.metaColor, marginTop: 6, textAlign: message.senderType === 'user' ? 'right' : 'left' }}>
        {formatTime(message.createdAt)}
      </Text>
    </View>
  );
}

function ActionCard({ action, onApprove, onReject, busy }) {
  const isPending = action.status === 'pending';
  const isReschedule = action.actionType === 'reschedule';
  const initiatedByUser = action.metadata?.initiatedBy === 'user';
  const actionTitle = (() => {
    if (isPending && initiatedByUser) return isReschedule ? 'Waiting for provider confirmation' : 'Waiting for provider response';
    if (isPending) return isReschedule ? 'Provider proposed a new time' : 'Provider requested cancellation';
    if (action.status === 'approved') return isReschedule ? 'Reschedule accepted' : 'Cancellation accepted';
    if (action.status === 'rejected') return isReschedule ? 'Reschedule declined' : 'Cancellation declined';
    return isReschedule ? 'Reschedule update' : 'Cancellation update';
  })();
  return (
    <View style={{
      backgroundColor: M.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isPending ? M.amber : M.border,
      padding: 14,
      marginBottom: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View style={{
          width: 28,
          height: 28,
          borderRadius: 10,
          backgroundColor: isPending ? M.amberBg : M.surfaceVar,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ic name={isReschedule ? 'cal' : 'alarm'} size={15} color={isPending ? M.amber : M.textMute} />
        </View>
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '800', color: M.text }}>
          {actionTitle}
        </Text>
        <Text style={{
          fontSize: 11,
          fontWeight: '800',
          color: isPending ? M.amber : action.status === 'approved' ? M.success : M.textMute,
          textTransform: 'uppercase',
        }}>
          {initiatedByUser && isPending ? 'WAITING' : action.status}
        </Text>
      </View>
      {isReschedule && (
        <Text style={{ fontSize: 13, color: M.text, fontWeight: '700', marginBottom: 5 }}>
          {action.proposedSlot || 'New time was not parsed clearly'}
        </Text>
      )}
      {!!action.reason && (
        <Text style={{ fontSize: 12, color: M.textMute, lineHeight: 18, marginBottom: isPending ? 12 : 0 }}>
          {action.reason}
        </Text>
      )}
      {isPending && !initiatedByUser && (
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <TouchableOpacity
            disabled={busy}
            onPress={() => onReject(action)}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: M.borderHi,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: M.text }}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={busy}
            onPress={() => onApprove(action)}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 12,
              backgroundColor: M.accent,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>Approve</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function BookingChatScreen() {
  const router = useRouter();
  const { bookingId, providerName } = useLocalSearchParams();
  const scrollRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [busyActionId, setBusyActionId] = useState(null);
  const [error, setError] = useState(null);
  const [booking, setBooking] = useState(null);
  const [messages, setMessages] = useState([]);
  const [actions, setActions] = useState([]);
  const [draft, setDraft] = useState('');

  const visibleMessages = useMemo(
    () => messages.filter((message) => !isInitialProviderDecisionMessage(message)),
    [messages]
  );
  const sortedMessages = useMemo(
    () => [...visibleMessages].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    [visibleMessages]
  );
  const sortedActions = useMemo(
    () => [...actions].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    [actions]
  );
  const pendingActions = useMemo(
    () => sortedActions.filter((action) => action.status === 'pending'),
    [sortedActions]
  );
  const resolvedActions = useMemo(
    () => sortedActions.filter((action) => action.status !== 'pending'),
    [sortedActions]
  );
  const providerDisplayName = useMemo(
    () => providerName || booking?.providerName || 'Provider',
    [booking?.providerName, providerName]
  );

  const loadConversation = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getConversation(bookingId);
      setBooking(result.booking || null);
      setMessages(result.messages || []);
      setActions(result.actions || []);
    } catch (err) {
      setError(err.message || 'Could not load chat.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!bookingId) return undefined;
    return subscribeToConversation(bookingId, {
      onMessage: (message) => setMessages((current) => upsertById(current, message, 'messageId')),
      onAction: (action) => setActions((current) => upsertById(current, action, 'actionId')),
    });
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId) return undefined;
    return subscribeToBooking(bookingId, (next) => {
      setBooking((current) => ({ ...(current || {}), ...next }));
    });
  }, [bookingId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd?.({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [sortedMessages.length, sortedActions.length]);

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    setDraft('');
    try {
      const result = await sendConversationMessage(bookingId, body);
      if (result?.message) {
        setMessages((current) => upsertById(current, result.message, 'messageId'));
      }
    } catch (err) {
      setDraft(body);
      setError(err.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  }, [bookingId, draft, sending]);

  const handleApprove = useCallback(async (action) => {
    setBusyActionId(action.actionId);
    setError(null);
    try {
      const result = await approveConversationAction(bookingId, action.actionId);
      if (result?.action) setActions((current) => upsertById(current, result.action, 'actionId'));
    } catch (err) {
      setError(err.message || 'Could not approve action.');
    } finally {
      setBusyActionId(null);
    }
  }, [bookingId]);

  const handleReject = useCallback(async (action) => {
    setBusyActionId(action.actionId);
    setError(null);
    try {
      const result = await rejectConversationAction(bookingId, action.actionId);
      if (result?.action) setActions((current) => upsertById(current, result.action, 'actionId'));
    } catch (err) {
      setError(err.message || 'Could not reject action.');
    } finally {
      setBusyActionId(null);
    }
  }, [bookingId]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: M.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <TopBar
        title="Booking chat"
        onBack={() => router.back()}
        action={
          <TouchableOpacity
            onPress={loadConversation}
            activeOpacity={0.7}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: M.surfaceLow,
              marginRight: 4,
            }}
          >
            {loading ? <ActivityIndicator size="small" color={M.accentDeep} /> : <Ic name="refresh" size={17} color={M.text} weight={2.2} />}
          </TouchableOpacity>
        }
      />
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: M.divider }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: M.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {bookingId}
        </Text>
        <Text style={{ fontSize: 15, fontWeight: '800', color: M.text, marginTop: 2 }}>
          With {providerDisplayName}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 14, paddingBottom: 18 }}
      >
        {error && (
          <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: M.error, fontWeight: '700' }}>{error}</Text>
          </View>
        )}

        <BookingSummaryCard booking={booking || { bookingId }} providerName={providerDisplayName} />

        {pendingActions.length > 0 && <SectionLabel>Pending actions</SectionLabel>}
        {pendingActions.map((action) => (
          <ActionCard
            key={action.actionId}
            action={action}
            busy={busyActionId === action.actionId}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))}

        {resolvedActions.length > 0 && <SectionLabel>Actions taken</SectionLabel>}
        {resolvedActions.map((action) => (
          <ActionCard
            key={action.actionId}
            action={action}
            busy={false}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))}

        <SectionLabel>Chat</SectionLabel>

        {loading && sortedMessages.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator color={M.accent} />
          </View>
        ) : sortedMessages.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 44 }}>
            <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: M.accentBg, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ic name="msg" size={24} color={M.accentDeep} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '800', color: M.text }}>No messages yet</Text>
            <Text style={{ fontSize: 12, color: M.textMute, marginTop: 5, textAlign: 'center' }}>
              Send a note and the provider will receive it on WhatsApp.
            </Text>
          </View>
        ) : (
          sortedMessages.map((message) => <MessageBubble key={message.messageId} message={message} />)
        )}

      </ScrollView>

      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: Platform.OS === 'ios' ? 22 : 12,
        borderTopWidth: 1,
        borderTopColor: M.divider,
        backgroundColor: M.surface,
      }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message the provider"
          placeholderTextColor={M.textDim}
          multiline
          style={{
            flex: 1,
            maxHeight: 112,
            minHeight: 44,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: M.border,
            backgroundColor: M.surfaceLow,
            paddingHorizontal: 13,
            paddingTop: 11,
            paddingBottom: 10,
            fontSize: 14,
            color: M.text,
            fontWeight: '600',
          }}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!draft.trim() || sending}
          activeOpacity={0.82}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: !draft.trim() || sending ? M.borderHi : M.accent,
          }}
        >
          {sending ? <ActivityIndicator color="#FFFFFF" /> : <Ic name="send" size={18} color="#FFFFFF" weight={2.4} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
