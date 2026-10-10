import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import type { SupabaseClient } from '@supabase/supabase-js';

type Props = { client: SupabaseClient; userId?: string; savedIds?: string[]; onClose: () => void };
export default function PostCollection({ client, userId, savedIds, onClose }: Props) {
  const [profile, setProfile] = useState<{ display_name: string; username: string; bio: string } | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        let query = client.from('posts').select('id,caption,media_url,media_type,created_at').order('created_at', { ascending: false }).limit(60);
        if (userId) query = query.eq('user_id', userId);
        else if (savedIds?.length) query = query.in('id', savedIds);
        else { if (active) setPosts([]); return; }
        const [result, person] = await Promise.all([
          query,
          userId ? client.from('profiles').select('display_name,username,bio').eq('id', userId).maybeSingle() : Promise.resolve({ data: null, error: null })
        ]);
        if (result.error) throw result.error;
        if (person.error) throw person.error;
        if (active) { setPosts(result.data || []); setProfile(person.data); }
      } catch (e: any) { if (active) setError(e.message || 'Could not load posts. Try Refresh.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [client, userId, savedIds, refresh]);
  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={s.screen}>
      <View style={s.header}><Pressable accessibilityRole="button" onPress={onClose} style={s.control}><Text style={s.link}>Close</Text></Pressable>
        <Text style={s.title} numberOfLines={1}>{userId ? profile?.display_name || 'Creator dossier' : 'Saved intel'}</Text>
        <Pressable accessibilityRole="button" onPress={() => setRefresh(v => v + 1)} style={s.control}><Text style={s.link}>Refresh</Text></Pressable></View>
      {profile ? <View style={s.card}><Text style={s.link}>@{profile.username}</Text>{profile.bio ? <Text style={s.text}>{profile.bio}</Text> : null}</View> : null}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#e0bd7b" /> : <FlatList data={posts} keyExtractor={p => p.id}
        ListEmptyComponent={<Text style={s.note}>{userId ? 'No visible posts from this creator yet.' : 'No saved posts available. Tap Save on a feed post to add it here.'}</Text>}
        renderItem={({ item: p }) => <View style={s.card}>
          {p.media_type === 'video' ? <Video source={{ uri: p.media_url }} style={s.media} resizeMode={ResizeMode.CONTAIN} useNativeControls /> : <Image source={{ uri: p.media_url }} style={s.media} resizeMode="contain" />}
          <Text style={s.text}>{p.caption}</Text><Text style={s.note}>{new Date(p.created_at).toLocaleDateString()}</Text>
        </View>} />}
    </SafeAreaView>
  </Modal>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b0d09' }, header: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  control: { padding: 12, minHeight: 44 }, title: { flex: 1, color: '#f2eddf', fontWeight: '800', fontSize: 22 },
  link: { color: '#e0bd7b', fontWeight: '800' }, card: { margin: 10, padding: 14, backgroundColor: '#1e251a', borderRadius: 7 },
  text: { color: '#f2eddf', fontSize: 15, lineHeight: 22, marginTop: 10 }, note: { color: '#b8baa6', padding: 12 },
  error: { color: '#ffb4b4', padding: 12 }, media: { width: '100%', aspectRatio: 9 / 12, borderRadius: 6 }
});
