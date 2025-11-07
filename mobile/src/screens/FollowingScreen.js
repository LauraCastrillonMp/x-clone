import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import Header from '../components/Header';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { getFollowing, followUser, unfollowUser } from '../services/api';

const PAGE_SIZE = 10;

export default function FollowingScreen({ route, navigation }) {
  const username = route?.params?.username?.toLowerCase?.() || '';
  const explicitIsSelf = route?.params?.isSelf === true;

  const [myUsername, setMyUsername] = useState('');
  const [busyMap, setBusyMap] = useState({});
  useEffect(() => {
    (async () => {
      try {
        const u = ((await AsyncStorage.getItem('username')) || '').toLowerCase();
        setMyUsername(u);
      } catch {}
    })();
  }, []);
  const isSelf = explicitIsSelf || (!!myUsername && !!username && myUsername === username);

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const sortUsers = useCallback((list) => {
    const coll = new Intl.Collator(undefined, { sensitivity: 'base' });
    return [...list].sort((a, b) =>
      coll.compare((a.fullName || a.username || '').trim(), (b.fullName || b.username || '').trim())
    );
  }, []);

  // make load support silent refresh (imitate FollowersScreen behaviour)
  const load = useCallback(async (p = 1, { silent = false } = {}) => {
    if (!username) return;
    if (p === 1 && !silent) setLoading(true);
    if (p > 1) setLoadingMore(true);
    try {
      const res = await getFollowing(username, p, PAGE_SIZE);
      const list = Array.isArray(res?.results) ? res.results : [];
      setItems(prev => {
        if (p === 1) return sortUsers(list);
        const seen = new Set(prev.map(u => u._id || u.id || u.username));
        const toAdd = list.filter(u => !seen.has(u._id || u.id || u.username));
        return sortUsers([...prev, ...toAdd]);
      });

      // follow FollowersScreen: prefer explicit server hasMore flag
      setHasMore(!!res?.hasMore && list.length > 0);
      setPage(p);
    } catch (e) {
      // keep behaviour minimal: you can set an error state here if desired
    } finally {
      if (p === 1 && !silent) setLoading(false);
      if (p > 1) setLoadingMore(false);
      setRefreshing(false);
    }
  }, [username, sortUsers]);

  useEffect(() => { setLoading(true); load(1); }, [load]);

  // silent refresh when returning to this screen (same as FollowersScreen)
  useFocusEffect(
    useCallback(() => {
      if (username) load(1, { silent: true });
    }, [username, load])
  );

  const onRefresh = useCallback(() => { setRefreshing(true); load(1); }, [load]);

  // imitate FollowersScreen onLoadMore behaviour
  const onLoadMore = useCallback(() => {
    if (hasMore && !loadingMore) { setLoadingMore(true); load(page + 1); }
  }, [hasMore, loadingMore, page, load]);

  const onToggleFollow = async (targetUsername, currentlyFollowing) => {
    if (!targetUsername || busyMap[targetUsername]) return;
    setBusyMap(m => ({ ...m, [targetUsername]: true }));
    try {
      if (currentlyFollowing) {
        await unfollowUser(targetUsername);
        setItems(prev => (isSelf
          ? prev.filter(u => u.username !== targetUsername) // remove from my Following list
          : prev.map(u => u.username === targetUsername ? { ...u, isFollowing: false } : u)));
      } else {
        await followUser(targetUsername);
        setItems(prev => prev.map(u => u.username === targetUsername ? { ...u, isFollowing: true } : u));
      }
    } finally {
      setBusyMap(m => ({ ...m, [targetUsername]: false }));
    }
  };

  const renderItem = ({ item }) => {
    const isMe = !!myUsername && (item?.username || '').toLowerCase() === myUsername;
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('PublicProfile', { username: item.username })}
      >
        <View style={styles.avatarWrap}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>
                {(item.fullName?.[0] || item.username?.[0] || 'U').toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{item.fullName || item.username}</Text>
          <Text style={styles.handle} numberOfLines={1}>@{item.username}</Text>
        </View>
        {!isMe && (
          <TouchableOpacity
            style={styles.followBtn}
            disabled={!!busyMap[item.username]}
            onPress={() => onToggleFollow(item.username, !!item.isFollowing)}
          >
            <Text style={styles.followBtnText}>
              {busyMap[item.username] ? '...' : (item.isFollowing ? 'Unfollow' : 'Follow')}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#eadeffff' }}>
      <Header title={`@${username} • Following`} onBack={() => navigation?.goBack?.()} />
      {loading && items.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color="#6A1B9A" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it, idx) => it._id || it.id || `${it.username}-${idx}`}
          renderItem={renderItem}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.muted}>No following</Text></View>}
          ListFooterComponent={
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              {loadingMore ? <ActivityIndicator color="#6A1B9A" /> : hasMore ? (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={onLoadMore}
                  disabled={loadingMore}
                  activeOpacity={0.8}
                >
                  <Text style={styles.loadMoreText}>Load more</Text>
                </TouchableOpacity>
              ) : <Text style={styles.muted}>No more</Text>}
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6A1B9A" />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', marginHorizontal: 8, marginTop: 8, borderRadius: 12 },
  avatarWrap: { marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: '#E2D7F3', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#4A148C', fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '700', color: '#4A148C' },
  handle: { fontSize: 12, color: '#7E57C2', marginTop: 2 },
  followBtn: { backgroundColor: '#6A1B9A', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  followBtnText: { color: '#FFF', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#7E57C2' },
  loadMoreBtn: { backgroundColor: '#EEE', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  loadMoreText: { color: '#4A148C', fontWeight: '700' },
});
