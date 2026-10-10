import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

export type MarketThread = { listingId: string; peerId: string; title: string };
type Message = { id: string; listing_id: string; sender_id: string; recipient_id: string; body: string; created_at: string };
type Props = { client: SupabaseClient; session: Session; initialThread: MarketThread | null; onClose: () => void };

export default function MarketplaceInbox({ client, session, initialThread, onClose }: Props) {
  const [thread, setThread] = useState<MarketThread | null>(initialThread);
  const [messages, setMessages] = useState<Message[]>([]);
  const [peers, setPeers] = useState<Record<string, string>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const mounted = useRef(true);
  const loadVersion = useRef(0);
  const sendingRef = useRef(false);
  const userId = session.user.id;

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      let query = client.from('marketplace_messages')
        .select('id,listing_id,sender_id,recipient_id,body,created_at')
        .order('created_at', { ascending: false }).limit(100);
      // RLS protects participants; explicit pair filters keep different buyers' threads separate.
      if (thread) query = query.eq('listing_id', thread.listingId).or(
        `and(sender_id.eq.${userId},recipient_id.eq.${thread.peerId}),and(sender_id.eq.${thread.peerId},recipient_id.eq.${userId})`
      );
      const result = await query;
      if (result.error) throw result.error;
      if (!mounted.current || version !== loadVersion.current) return;
      const rows = (result.data || []) as Message[];
      setMessages(rows);
      setError('');
      const peerIds = [...new Set(rows.map(m => m.sender_id === userId ? m.recipient_id : m.sender_id))];
      const listingIds = [...new Set(rows.map(m => m.listing_id))];
      const [profiles, listings] = await Promise.all([
        peerIds.length ? client.from('profiles').select('id,username,display_name').in('id', peerIds) : Promise.resolve({ data: [] }),
        listingIds.length ? client.from('marketplace_listings').select('id,title').in('id', listingIds) : Promise.resolve({ data: [] })
      ]);
      if (!mounted.current || version !== loadVersion.current) return;
      setPeers(Object.fromEntries((profiles.data || []).map(p => [p.id, p.display_name || p.username || 'Member'])));
      setTitles(Object.fromEntries((listings.data || []).map(l => [l.id, l.title])));
    } catch (e: any) {
      if (mounted.current && version === loadVersion.current) setError(e.message || 'Could not load messages. Tap Refresh to try again.');
    } finally {
      if (mounted.current && version === loadVersion.current) setLoading(false);
    }
  }, [client, userId, thread?.listingId, thread?.peerId]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++loadVersion.current; };
  }, []);
  useEffect(() => {
    setMessages([]);
    setBody('');
    setError('');
    setLoading(true);
    void load();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 5000);
    return () => { clearInterval(timer); ++loadVersion.current; };
  }, [load]);

  async function send() {
    const text = body.trim();
    if (!thread || !text || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError('');
    try {
      const result = await client.from('marketplace_messages').insert({
        listing_id: thread.listingId, sender_id: userId, recipient_id: thread.peerId, body: text
      });
      if (result.error) throw result.error;
      if (!mounted.current) return;
      setBody('');
      await load();
    } catch (e: any) {
      if (mounted.current) setError(e.message || 'Message was not sent. Please retry.');
    } finally {
      sendingRef.current = false;
      if (mounted.current) setSending(false);
    }
  }

  const threads: Array<MarketThread & { last: Message }> = [];
  const seen = new Set<string>();
  for (const message of messages) {
    const peerId = message.sender_id === userId ? message.recipient_id : message.sender_id;
    const key = `${message.listing_id}:${peerId}`;
    if (!seen.has(key)) {
      seen.add(key);
      threads.push({ listingId: message.listing_id, peerId, title: titles[message.listing_id] || 'Marketplace listing', last: message });
    }
  }

  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" onPress={() => thread ? setThread(null) : onClose()} style={s.control}><Text style={s.link}>{thread ? '← Inbox' : 'Close'}</Text></Pressable>
          <Text style={s.title} numberOfLines={1}>{thread ? thread.title : 'Market messages'}</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={s.control}><Text style={s.link}>Refresh</Text></Pressable>
        </View>
        {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color="#e0bd78" style={{ margin: 20 }} /> : thread ?
          <FlatList inverted data={messages} keyExtractor={m => m.id} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={s.note}>Ask about availability, condition, or delivery. Messages are private to the participants.</Text>}
            renderItem={({ item: m }) => <View style={[s.message, m.sender_id === userId && s.own]}>
              <Text style={s.label}>{m.sender_id === userId ? 'You' : peers[m.sender_id] || 'Member'}</Text>
              <Text style={s.text}>{m.body}</Text>
              <Text style={s.date}>{new Date(m.created_at).toLocaleString()}</Text>
            </View>} /> :
          <FlatList data={threads} keyExtractor={t => `${t.listingId}:${t.peerId}`}
            ListEmptyComponent={<Text style={s.note}>No conversations yet. Open a listing and tap Contact seller to start one.</Text>}
            renderItem={({ item: t }) => <Pressable accessibilityRole="button" style={s.message} onPress={() => setThread(t)}>
              <Text style={s.label}>{t.title}</Text><Text style={s.text}>{peers[t.peerId] || 'Member'}</Text>
              <Text style={s.note} numberOfLines={2}>{t.last.sender_id === userId ? 'You: ' : ''}{t.last.body}</Text>
            </Pressable>} />}
        {thread ? <View style={s.composer}>
          <TextInput accessibilityLabel="Message to seller or buyer" value={body} onChangeText={setBody} maxLength={2000} multiline editable={!sending}
            placeholder="Write a message…" placeholderTextColor="#9ba9a0" style={s.input} />
          <Pressable accessibilityRole="button" disabled={sending || !body.trim()} onPress={() => void send()} style={[s.send, (sending || !body.trim()) && { opacity: .5 }]}>
            <Text style={{ fontWeight: '800' }}>{sending ? 'Sending…' : 'Send'}</Text>
          </Pressable>
        </View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0d0c' },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#2b3731', padding: 8, gap: 8 },
  control: { padding: 12, minHeight: 44 }, title: { flex: 1, color: '#f2f4ef', fontWeight: '800', fontSize: 17 },
  link: { color: '#e0bd78', fontWeight: '800' }, label: { color: '#e0bd78', fontWeight: '800', marginBottom: 6 },
  text: { color: '#f2f4ef', fontSize: 15, lineHeight: 22 }, date: { color: '#9ba9a0', fontSize: 10, marginTop: 8 },
  note: { color: '#9ba9a0', fontSize: 13, padding: 12, lineHeight: 20 }, error: { color: '#ffb4b4', padding: 12 },
  message: { backgroundColor: '#121816', borderWidth: 1, borderColor: '#2b3731', padding: 14, borderRadius: 14, margin: 8 },
  own: { backgroundColor: '#29261d', marginLeft: 38 }, composer: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 },
  input: { flex: 1, maxHeight: 130, minHeight: 48, color: '#f2f4ef', backgroundColor: '#121816', padding: 12, borderRadius: 12 },
  send: { backgroundColor: '#e0bd78', padding: 14, borderRadius: 12, minHeight: 48 }
});
