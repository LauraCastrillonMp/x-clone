import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import TweetCard from '../components/TweetCard';
import { getFeed, toggleLike } from '../services/api';

export default function HomeScreen({ navigation }) {
  const [tweets, setTweets] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const likeLocks = React.useRef(new Set());
  const PAGE_SIZE = 10;

  const loadFeed = async (p = 1) => {
    if ((p === 1 && loading) || (p > 1 && loadingMore)) return;
    try {
      p === 1 ? setLoading(true) : setLoadingMore(true);
      const res = await getFeed(p, PAGE_SIZE);
      const list = Array.isArray(res?.tweets) ? res.tweets : [];
      const total = Number.isFinite(res?.total) ? res.total : undefined;
      const topLevel = list.filter(t => !(t.parentId || t.parent || t.replyTo || t.inReplyToId || t.isReply));

      if (p === 1) {
        setTweets(topLevel);
      } else {
        setTweets(prev => {
          const map = new Map(prev.map(t => [String(t._id || t.id), t]));
          for (const t of topLevel) map.set(String(t._id || t.id), t);
          return Array.from(map.values());
        });
      }

      setPage(p);
      const moreByTotal = total ? p * PAGE_SIZE < total : undefined;
      setHasMore(moreByTotal ?? (topLevel.length === PAGE_SIZE));
    } finally {
      p === 1 ? (setLoading(false), setRefreshing(false)) : setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadFeed(1);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setHasMore(true);
    loadFeed(1);
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    // Compute next page from current state to avoid stale closures
    setPage(prev => {
      const next = prev + 1;
      loadFeed(next);
      return next;
    });
  };

  const handleToggleLike = async (id) => {
    const key = String(id);
    if (likeLocks.current.has(key)) return;
    likeLocks.current.add(key);
    try {
      // Optimistic UI
      setTweets(prev =>
        prev.map(t =>
          (t._id || t.id) === id
            ? {
                ...t,
                likedByCurrentUser: !t.likedByCurrentUser,
                likesCount: (t.likesCount || 0) + (t.likedByCurrentUser ? -1 : 1),
              }
            : t
        )
      );
      await toggleLike(id);
    } finally {
      likeLocks.current.delete(key);
    }
  };

  const renderItem = ({ item }) => (
    <TweetCard
      tweet={item}
      onToggleLike={() => handleToggleLike(item._id || item.id)}
      onPress={() => navigation.navigate('TweetDetail', { tweetId: item._id || item.id })}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F4FF' }}>
      <TouchableOpacity style={styles.composeBtn} onPress={() => navigation.navigate('Compose')}>
        <Text style={styles.composeText}>Tweet</Text>
      </TouchableOpacity>

      <FlatList
        data={tweets}
        keyExtractor={item => String(item._id || item.id)}
        renderItem={renderItem}
        ListFooterComponent={
          tweets.length >= PAGE_SIZE ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              {loadingMore ? (
                <ActivityIndicator color="#6A1B9A" />
              ) : hasMore ? (
                <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore} disabled={loadingMore}>
                  <Text style={styles.loadMoreText}>Load more</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.muted}>No more</Text>
              )}
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6A1B9A" />
        }
        // Avoid auto onEndReached; use only the button
        onEndReached={undefined}
        onEndReachedThreshold={undefined}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  composeBtn: {
    backgroundColor: '#6A1B9A',
    padding: 12,
    margin: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  composeText: { color: '#fff', fontWeight: '700' },
  loadMoreBtn: { backgroundColor: '#6A1B9A', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  loadMoreText: { color: '#fff', fontWeight: '700' },
  muted: { color: '#777' },
});
