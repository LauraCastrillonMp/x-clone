import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StyleSheet, Image, RefreshControl,
  TouchableOpacity, Alert,
} from 'react-native';
import Header from '../components/Header';
import TweetCard from '../components/TweetCard';
import { getProfile, getUserTweets, toggleLike, getFollowStatus, followUser, unfollowUser } from '../services/api';

const PAGE_SIZE = 10;

export default function PublicProfileScreen({ route, navigation }) {
  const likeLocks = useRef(new Set());
  const routeUsername = route?.params?.username?.toLowerCase?.() || '';
  const [username, setUsername] = useState(routeUsername);
  const [profile, setProfile] = useState(null);
  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [cachedUsername, setCachedUsername] = useState('');

  const isOwnProfile = useMemo(() => {
    return username && cachedUsername && username === cachedUsername.toLowerCase();
  }, [username, cachedUsername]);

  useEffect(() => {
    AsyncStorage.getItem('username')
      .then(u => setCachedUsername((u || '').toLowerCase()))
      .catch(() => setCachedUsername(''));
  }, []);

  // replace any mount/fetch behavior with focus-based load so tweets load when screen opens
  const loadTweets = useCallback(
    async (p = 1) => {
      if (!username) return;
      try {
        // only show global loading for first page, use loadingMore for subsequent pages
        if (p === 1) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const res = await getUserTweets(username, p);
        const list = Array.isArray(res) ? res : res?.tweets || [];
        setTweets(prev => {
          if (p === 1) return list;
          const seen = new Set(prev.map(t => t._id || t.id));
          const toAdd = list.filter(t => !seen.has(t._id || t.id));
          return [...prev, ...toAdd];
        });
        setHasMore((list?.length || 0) >= PAGE_SIZE);
        setPage(p);
      } catch (e) {
        console.warn('loadTweets error', e?.message || e);
      } finally {
        // clear only the flags we set
        if (p === 1) {
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
    },
    [username]
  );

  // load tweets whenever this screen is focused or username changes
  useFocusEffect(
    useCallback(() => {
      // reset to first page on focus
      loadTweets(1).catch(err => console.warn('useFocusEffect loadTweets error', err));
      return () => {};
    }, [username, loadTweets])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const res = await getProfile(username);
      const p = res?.user || res || null;
      setProfile(p);
      setIsFollowing(!!(p?.isFollowing || p?.followingYou));
    } catch {}
    await loadTweets(1);
    setRefreshing(false);
  }, [username, loadTweets]);

  // ensure we have profile header
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!username) return;
      setLoadingHeader(true);
      try {
        const res = await getProfile(username);
        if (!alive) return;
        setProfile(res?.user || res?.data?.user || res?.data || res || null);
      } catch (e) {
        if (!alive) return;
        setError('Failed to load profile');
      } finally {
        if (alive) setLoadingHeader(false);
      }
    })();
    return () => { alive = false; };
  }, [username]);

  // load follow status whenever screen is focused or username changes
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!username) return;
        try {
          const { isFollowing } = await getFollowStatus(username);
          if (!cancelled) setIsFollowing(!!isFollowing);
        } catch {
          if (!cancelled) setIsFollowing(false);
        }
      })();
      return () => { cancelled = true; };
    }, [username])
  );

  async function handleToggleLike(id) {
    if (!id || likeLocks.current.has(id)) return;
    likeLocks.current.add(id);
    setTweets(prev =>
      prev.map(t =>
        (t._id || t.id) === id
          ? {
              ...t,
              likedByCurrentUser: !t.likedByCurrentUser,
              likesCount: Math.max(0, (t.likesCount || 0) + (t.likedByCurrentUser ? -1 : 1)),
            }
          : t
      )
    );
    try {
      const updated = await toggleLike(id);
      if (updated) {
        setTweets(prev =>
          prev.map(t =>
            (t._id || t.id) === id
              ? { ...t, likesCount: updated.likesCount, likedByCurrentUser: updated.liked }
              : t
          )
        );
      }
    } catch {
      setTweets(prev =>
        prev.map(t =>
          (t._id || t.id) === id
            ? {
                ...t,
                likedByCurrentUser: !t.likedByCurrentUser,
                likesCount: Math.max(0, (t.likesCount || 0) + (t.likedByCurrentUser ? -1 : 1)),
              }
            : t
        )
      );
    } finally {
      likeLocks.current.delete(id);
    }
  }

  // follow/unfollow handlers (optimistic)
  const onToggleFollow = useCallback(async () => {
    if (!username || followBusy) return;
    setFollowBusy(true);
    try {
      if (isFollowing) {
        const r = await unfollowUser(username);
        setIsFollowing(false);
        setProfile(p => (p ? { ...p, followersCount: Math.max(0, (p.followersCount || 0) - 1) } : p));
      } else {
        const r = await followUser(username);
        setIsFollowing(true);
        setProfile(p => (p ? { ...p, followersCount: (p.followersCount || 0) + 1 } : p));
      }
    } catch (e) {
      setError('Failed to update follow');
    } finally {
      setFollowBusy(false);
    }
  }, [username, isFollowing, followBusy]);

  const Avatar = ({ uri, size = 88 }) => (
    <View style={[styles.avatarWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={styles.avatarInitials}>
            {profile?.fullName?.[0]?.toUpperCase?.() || profile?.username?.[0]?.toUpperCase?.() || 'U'}
          </Text>
        </View>
      )}
    </View>
  );

  const HeaderCounts = () => (
    <View style={styles.counters}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.countItem}
        onPress={() => username && navigation.navigate('Following', { username, isSelf: false })}
      >
        <Text style={styles.countNum}>{profile?.followingCount ?? 0}</Text>
        <Text style={styles.countLbl}>Following</Text>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.countItem}
        onPress={() => username && navigation.navigate('Followers', { username, isSelf: false })}
      >
        <Text style={styles.countNum}>{profile?.followersCount ?? 0}</Text>
        <Text style={styles.countLbl}>Followers</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.profileTop}>
      <View style={styles.hero}>
        <Avatar uri={profile?.avatarUrl} />
        <Text style={styles.name}>{profile?.fullName || ''}</Text>
        <Text style={styles.username}>@{username || ''}</Text>
        {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        <HeaderCounts />
        {!loadingHeader && profile && (
          <View style={{ marginTop: 12 }}>
            {isOwnProfile ? null : (
              <TouchableOpacity
                disabled={followBusy}
                style={[styles.pageBtn, followBusy && styles.pageBtnDisabled]}
                onPress={onToggleFollow}
              >
                <Text style={followBusy ? styles.pageBtnTextDisabled : styles.pageBtnText}>
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tweets</Text>
      </View>
      {tweets.length === 0 && !loadingMore && (
        <View style={styles.loadingBox}>
          <Text style={styles.muted}>No tweets yet</Text>
        </View>
      )}
    </View>
  );

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore) {
      // mark loadingMore and await the load so UI stays consistent
      setLoadingMore(true);
      loadTweets(page + 1).catch(err => {
        console.warn('handleLoadMore loadTweets error', err);
        setLoadingMore(false);
      });
    }
  }, [hasMore, loadingMore, loadTweets, page]);

  return (
    <View style={{ flex: 1, backgroundColor: '#eadeffff' }}>
      <Header title={username ? `@${username}` : 'Profile'} onBack={() => navigation?.goBack?.()} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={tweets}
          keyExtractor={item => item._id || item.id}
          renderItem={({ item }) => (
            <TweetCard
              tweet={item}
              onToggleLike={() => handleToggleLike(item._id || item.id)}
              onPress={() => navigation.navigate('Home', {
                screen: 'TweetDetail',
                params: { tweetId: item._id || item.id },
              })}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={
            tweets.length >= PAGE_SIZE ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                {loadingMore ? (
                  <ActivityIndicator color="#6A1B9A" />
                ) : hasMore ? (
                  <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore}>
                    <Text style={styles.loadMoreText}>Load more</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.muted}>No more</Text>
                )}
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
      {!!error && !loadingHeader && (
        <View style={styles.errorBanner}>
          <Text style={styles.errText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 16, paddingBottom: 8, paddingHorizontal: 16 },
  profileTop: {
    backgroundColor: '#FFF', borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  avatarWrap: { borderWidth: 3, borderColor: '#E2D7F3', overflow: 'hidden' },
  avatarFallback: { backgroundColor: '#E2D7F3', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#4A148C', fontSize: 28, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: '#4A148C' },
  username: { marginTop: 4, fontSize: 14, color: '#7E57C2' },
  bio: { marginTop: 10, fontSize: 14, color: '#4E4E4E', textAlign: 'center' },
  counters: { flexDirection: 'row', marginTop: 12, gap: 24 },
  countItem: { alignItems: 'center' },
  countNum: { fontSize: 16, fontWeight: '700', color: '#4A148C' },
  countLbl: { fontSize: 12, color: '#7E57C2' },
  sectionHeader: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEE' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#4A148C' },
  loadingBox: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#7E57C2' },
  pageBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#6A1B9A', borderRadius: 8 },
  pageBtnDisabled: { backgroundColor: '#CAB3E3' },
  pageBtnText: { color: '#FFF', fontWeight: '700' },
  pageBtnTextDisabled: { color: '#F3E9FF' },
  errorBanner: { position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: '#FFE6E6', borderRadius: 8, padding: 10 },
  errText: { color: '#C62828', textAlign: 'center' },
  loadMoreBtn: { backgroundColor: '#EEE', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  loadMoreText: { color: '#4A148C', fontWeight: '700' },
});