import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, StyleSheet, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
  // store locally-posted comments that may not appear immediately from the server
  const pendingComments = React.useRef(new Map());

  const remaining = useMemo(() => MAX_TWEET_CHARS - (reply?.length || 0), [reply]);
  const canReply = reply.trim().length > 0 && reply.length <= MAX_TWEET_CHARS;

  // replace loadTweet function with a callback so we can call it on focus
  const loadTweet = useCallback(async () => {
    setLoading(true);
    try {
      const t = await getTweet(tweetId);
      const c = await getComments(tweetId);
      // Merge server comments with any locally pending comments so optimistic items
      // don't get wiped when we re-sync from the network.
      const serverComments = Array.isArray(c) ? c : [];

      // If server now returned an item matching a pending local comment, drop the pending one.
      for (const server of serverComments) {
        const sid = String(server._id || server.id);
        if (pendingComments.current.has(sid)) {
          pendingComments.current.delete(sid);
        }
      }

      // Compose final list: show pending local comments first (newest), then server comments
      const merged = [
        ...Array.from(pendingComments.current.values()),
        ...serverComments.filter(s => !pendingComments.current.has(String(s._id || s.id))),
      ];

      setTweet(t);
      setComments(merged);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  }, [tweetId]);

  useEffect(() => {
    loadTweet();
  }, [loadTweet]);

  // reload when screen becomes focused so comments don't "disappear" after navigating back
  useFocusEffect(
    useCallback(() => {
      loadTweet();
    }, [loadTweet])
  );

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
        // Ensure the local object has an id we can track; server may not surface it
        const id = String(newComment._id || newComment.id || `local_${Date.now()}`);
        newComment._id = newComment._id || newComment.id || id;
        // mark local-only so we can merge/sync later
        newComment.__local = true;
        newComment.parentId = newComment.parentId || tweetId;
        newComment.inReplyToId = newComment.inReplyToId || tweetId;
        newComment.isReply = true;

        // keep a pending map so future reloads can merge instead of wiping
        pendingComments.current.set(String(newComment._id), newComment);

        // show immediately
        setComments(prev => [newComment, ...prev]);
        setText('');
        setTweet(prev => {
          const updated = { ...prev, commentsCount: (prev.commentsCount || 0) + 1 };
          // inform parent only about the new count (avoid sending full comments to the feed)
          route.params?.onUpdate?.({ id: tweetId, commentsCount: updated.commentsCount });
          return updated;
        });
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

  const KEYBOARD_OFFSET = Platform.OS === 'ios' ? 90 : 80;
  const COMPOSER_HEIGHT = 56; // used to provide bottom padding so list items are visible above composer

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={KEYBOARD_OFFSET}
    >
      <View style={{ flex: 1, backgroundColor: '#eadeffff' }}>
        <Header title="Tweet Detail" />

        <View style={styles.body}>
          {tweet && <TweetCard tweet={tweet} onToggleLike={handleToggleLike} />}

          <Text style={styles.commentsHeader}>Comments</Text>

          {/* container for the scrollable list */}
          <View style={{ flex: 1 }}>
            <FlatList
              data={comments}
              keyExtractor={c => String(c._id)}
              renderItem={({ item }) => <TweetCard tweet={item} onToggleLike={handleToggleLike} />}
              ListEmptyComponent={<Text style={styles.empty}>No comments yet</Text>}
              contentContainerStyle={{ padding: 12, paddingBottom: COMPOSER_HEIGHT + KEYBOARD_OFFSET + 12 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator
            />
          </View>

          {/* composer is absolute so list can fully scroll underneath */}
          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Write a comment..."
              style={styles.input}
              multiline={false}
              returnKeyType="send"
              onSubmitEditing={handlePostComment}
            />
            <TouchableOpacity onPress={handlePostComment} style={styles.sendBtn} disabled={!text.trim()}>
              <Icon name="send" size={22} color={text.trim() ? '#1da1f2' : '#bbb'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// update styles
const styles = StyleSheet.create({
  body: { flex: 1 },
  commentsHeader: { textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#333', marginTop: 12, marginBottom: 8 },
  empty: { textAlign: 'center', color: '#666', marginTop: 12 },
  composer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  input: { flex: 1, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#f2f2f2', marginRight: 8, minHeight: 40 },
  sendBtn: { padding: 6 },
});
