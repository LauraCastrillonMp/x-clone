import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { toggleLike, getTweet, getComments, postComment } from '../services/api';
import TweetCard from '../components/TweetCard';
import Header from '../components/Header';

const MAX_TWEET_CHARS = 280;

export default function TweetDetailScreen({ route }) {
  const { tweetId } = route.params;
  const [tweet, setTweet] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
  const likeLocks = React.useRef(new Set());

  const remaining = useMemo(() => MAX_TWEET_CHARS - (reply?.length || 0), [reply]);
  const canReply = reply.trim().length > 0 && reply.length <= MAX_TWEET_CHARS;

  useEffect(() => {
    loadTweet();
  }, []);

  async function loadTweet() {
    setLoading(true);
    try {
      const t = await getTweet(tweetId);
      const c = await getComments(tweetId);
      setTweet(t);
      setComments(c || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleLike(id) {
    if (likeLocks.current.has(id)) return;
    likeLocks.current.add(id);

    const isMain = tweet && tweet._id === id;

    // optimistic
    if (isMain) {
      setTweet(prev => ({
        ...prev,
        likedByCurrentUser: !prev.likedByCurrentUser,
        likesCount: Math.max(0, (prev.likesCount || 0) + (prev.likedByCurrentUser ? -1 : 1)),
      }));
    } else {
      setComments(prev =>
        prev.map(c =>
          c._id === id
            ? {
                ...c,
                likedByCurrentUser: !c.likedByCurrentUser,
                likesCount: Math.max(0, (c.likesCount || 0) + (c.likedByCurrentUser ? -1 : 1)),
              }
            : c
        )
      );
    }

    try {
      const updated = await toggleLike(id);
      if (updated) {
        if (isMain) {
          setTweet(prev => ({ ...prev, likesCount: updated.likesCount, likedByCurrentUser: updated.liked }));
          // keep Home in sync
          route.params?.onUpdate?.({ id, liked: updated.liked, likesCount: updated.likesCount });
        } else {
          setComments(prev =>
            prev.map(c =>
              c._id === id
                ? { ...c, likesCount: updated.likesCount, likedByCurrentUser: updated.liked }
                : c
            )
          );
        }
      }
    } catch (e) {
      await loadTweet(); // rollback/resync
      console.warn('toggleLike error', e);
    } finally {
      likeLocks.current.delete(id);
    }
  }

  async function handlePostComment() {
    const body = text.trim();
    if (!body) return;
    try {
      const newComment = await postComment(tweetId, body);
      if (newComment) {
        setComments(prev => [newComment, ...prev]);
        setText('');
        setTweet(prev => ({ ...prev, commentsCount: (prev.commentsCount || 0) + 1 }));
      }
    } catch (err) {
      console.warn(err);
    }
  }

  const onChangeReply = (t) => setReply(String(t || '').slice(0, MAX_TWEET_CHARS));

  const onSendReply = async () => {
    if (!canReply) return;
    // ...existing code... // post comment using `reply`
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View style={{ flex: 1, backgroundColor: '#F8F4FF' }}>
        <Header title="Tweet Detail" />
        <View style={styles.body}>
          {tweet && <TweetCard tweet={tweet} onToggleLike={handleToggleLike} />}

          <Header title="Comments" />
          <FlatList
            data={comments}
            keyExtractor={c => c._id}
            renderItem={({ item }) => <TweetCard tweet={item} onToggleLike={handleToggleLike} />}
            ListEmptyComponent={<Text style={styles.empty}>No comments yet</Text>}
            contentContainerStyle={{ padding: 12 }}
          />

          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Write a comment..."
              style={styles.input}
              multiline={false}
            />
            <TouchableOpacity onPress={handlePostComment} style={styles.sendBtn} disabled={!text.trim()}>
              <Icon name="send" size={22} color={text.trim() ? '#1da1f2' : '#bbb'} />
            </TouchableOpacity>
          </View>

          <TextInput
            value={reply}
            onChangeText={onChangeReply}
            maxLength={MAX_TWEET_CHARS}
            placeholder="Tweet your reply"
            multiline
            style={{ minHeight: 80 }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>{reply.length}/{MAX_TWEET_CHARS}</Text>
            <TouchableOpacity onPress={onSendReply} disabled={!canReply}>
              <Text style={{ opacity: canReply ? 1 : 0.4 }}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  empty: { textAlign: 'center', color: '#666', marginTop: 12 },
  composer: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderColor: '#eee', alignItems: 'center' },
  input: { flex: 1, padding: 10, borderRadius: 20, backgroundColor: '#f2f2f2', marginRight: 8 },
  sendBtn: { padding: 6 },
});
