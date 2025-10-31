import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Header from '../components/Header';
import TweetCard from '../components/TweetCard';
import { useFocusEffect } from '@react-navigation/native';
import { getMyProfile, getProfile, getUserTweets, toggleLike } from '../services/api';

const PAGE_SIZE = 10;
const PAGINATION_ENABLED = true;           // ENABLE paging
const SILENT_REFRESH_ENABLED = false;      // keep silent refresh off
const REFRESH_ENABLED = false;            // NEW: disable pull-to-refresh

// Helpers to normalize backend shapes
const toUser = (res) => {
  // handles { user }, { data: { user } }, { data }, or object itself
  const cand = res?.user ?? res?.data?.user ?? res?.data ?? res;
  return typeof cand === 'object' && cand ? cand : null;
};

const toUsername = (u) =>
  String(
    u?.username ?? u?.handle ?? u?.userName ?? u?.name?.username ?? u?.profile?.username ?? ''
  ).toLowerCase();

const toAvatarUrl = (u) =>
  u?.avatarUrl ?? u?.avatarURL ?? u?.photoURL ?? u?.avatar?.url ?? u?.avatar ?? u?.profileImageUrl ?? '';

const toCounts = (u = {}) => {
  const followers =
    typeof u.followersCount === 'number'
      ? u.followersCount
      : Array.isArray(u.followers)
      ? u.followers.length
      : typeof u.followers === 'number'
      ? u.followers
      : 0;

  const following =
    typeof u.followingCount === 'number'
      ? u.followingCount
      : Array.isArray(u.following)
      ? u.following.length
      : typeof u.following === 'number'
      ? u.following
      : 0;

  return { followers, following };
};

// Add a minimal Avatar component with fallback initials
function Avatar({ uri, size = 88, name, username }) {
  const src = String(name || username || '').trim();
  const parts = src ? src.split(/\s+/) : [];
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '';
  const initials = (first + last || '?').toUpperCase();

  const dim = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.avatarWrap, dim]}>
      {uri ? (
        <Image source={{ uri }} style={[dim]} resizeMode="cover" />
      ) : (
        <View style={[styles.avatarFallback, dim]}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
      )}
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  // data
  const [resolvedUsername, setResolvedUsername] = useState('');
  const [profile, setProfile] = useState(null);
  const [tweets, setTweets] = useState([]);

  // ui state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const likeLocks = useRef(new Set());
  const endGuard = useRef({ last: 0 });
  const lastFocusRefresh = useRef(0);
  // Add a ref to avoid re-creating loadTweets when loadingMore changes
  const loadingMoreRef = useRef(false);
  useEffect(() => { loadingMoreRef.current = loadingMore; }, [loadingMore]);

  // Resolve "me" first (try /users/me|/auth/me, fallback to cached username)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingHeader(true);
      setError('');
      try {
        const me = await getMyProfile();
        const meUser = toUser(me);
        const u = toUsername(meUser);
        if (!u) throw new Error('No username from /me');
        if (!alive) return;
        setResolvedUsername(u);
        setProfile(meUser);
        await AsyncStorage.setItem('username', u);
      } catch (e) {
        try {
          const cached = ((await AsyncStorage.getItem('username')) || '').toLowerCase();
          if (!alive) return;
          setResolvedUsername(cached);
          if (cached) {
            const res = await getProfile(cached);
            const p = toUser(res);
            if (!alive) return;
            setProfile(p);
          } else {
            setError('Sign in required');
          }
        } catch (e2) {
          if (!alive) return;
          setError('Failed to load profile');
        }
      } finally {
        if (alive) setLoadingHeader(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // If we got a profile but still don't have resolvedUsername, derive it
  useEffect(() => {
    if (!resolvedUsername && profile) {
      const u = toUsername(profile);
      if (u) setResolvedUsername(u);
    }
  }, [profile, resolvedUsername]);

  // Ensure we have the latest header from /users/:username
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!resolvedUsername) return;
      try {
        const res = await getProfile(resolvedUsername);
        const p = toUser(res);
        if (!alive) return;
        setProfile(prev => ({ ...(prev || {}), ...(p || {}) }));
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [resolvedUsername]);

  const loadTweets = useCallback(
    async (p = 1, beforeId = null) => {
      if (!resolvedUsername) return;
      // Use ref instead of state to guard
      if (p > 1 && loadingMoreRef.current) return;
      if (p > 1) setLoadingMore(true);
      try {
        const res = await getUserTweets(
          resolvedUsername,
          p,
          PAGE_SIZE,
          beforeId ? { beforeId } : undefined
        );

        const raw =
          (Array.isArray(res) && res) ||
          res?.tweets ||
          res?.data?.tweets ||
          res?.results ||
          res?.items ||
          res?.data ||
          [];
        const list = (Array.isArray(raw) ? raw : []).map(t => ({
          ...t,
          _id: t._id || t.id,
        }));

        let appended = 0;
        setTweets(prev => {
          if (p === 1) return list; // first page replaces
          const seen = new Set(prev.map(t => t._id || t.id));
          const toAdd = list.filter(t => {
            const k = t._id || t.id;
            return k && !seen.has(k);
          });
          appended = toAdd.length;
          return appended ? [...prev, ...toAdd] : prev;
        });

        const nextHasMore =
          (typeof res?.hasMore === 'boolean' && res.hasMore) ||
          (typeof res?.data?.hasMore === 'boolean' && res.data.hasMore) ||
          (typeof res?.pagination?.hasMore === 'boolean' && res.pagination.hasMore) ||
          (p === 1 ? list.length >= PAGE_SIZE : appended >= 1);

        setHasMore(!!nextHasMore);
        setPage(p);
      } catch (e) {
        if (p === 1) setError('Failed to load tweets');
        setHasMore(false);
      } finally {
        setLoadingMore(false);
      }
    },
    [resolvedUsername] // IMPORTANT: do not depend on loadingMore
  );

  // First tweets load (won’t re-run after loadMore anymore)
  useEffect(() => {
    if (!resolvedUsername) return;
    setError('');
    setHasMore(true);
    setPage(1);
    loadTweets(1);
  }, [resolvedUsername, loadTweets]);

  const onRefresh = useCallback(async () => {
    if (!resolvedUsername) return;
    setRefreshing(true);
    setError('');
    try {
      const res = await getProfile(resolvedUsername);
      const p = toUser(res);
      setProfile(p || profile);
      setHasMore(true);      // reset hasMore on pull-to-refresh
      await loadTweets(1);
    } finally {
      setRefreshing(false);
    }
  }, [resolvedUsername, loadTweets, profile]);

  const handleLoadMore = useCallback(() => {
    if (!PAGINATION_ENABLED) return;
    if (!resolvedUsername || loadingHeader || !hasMore || loadingMore) return;

    const now = Date.now();
    if (now - endGuard.current.last < 800) return;
    endGuard.current.last = now;

    const last = tweets[tweets.length - 1];
    const beforeId = last?._id || last?.id || null;
    loadTweets(page + 1, beforeId);
  }, [resolvedUsername, loadingHeader, hasMore, loadingMore, loadTweets, page, tweets]);

  async function handleToggleLike(id) {
    if (!id) return;
    if (likeLocks.current.has(id)) return;
    likeLocks.current.add(id);

    // optimistic toggle
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
      // rollback on error
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
      Alert.alert('Error', 'Could not update like');
    } finally {
      likeLocks.current.delete(id);
    }
  }

  // Refresh profile header and first page of tweets on focus
  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      async function refresh() {
        try {
          // refresh header
          if (resolvedUsername) {
            const res = await getProfile(resolvedUsername);
            const p = toUser(res);
            if (active && p) setProfile(prev => ({ ...(prev || {}), ...p }));
          }
        } catch {}

        try {
          // refresh tweets page 1
          if (resolvedUsername) {
            const res = await getUserTweets(resolvedUsername, 1, PAGE_SIZE);
            const list = Array.isArray(res?.tweets) ? res.tweets : [];
            if (active) {
              setTweets(list);
              setPage(1);
              setHasMore(list.length >= PAGE_SIZE);
            }
          }
        } catch {}
      }

      refresh();
      return () => { active = false; };
    }, [resolvedUsername])
  );

  // Make sure your pull-to-refresh state is NOT set to true on mount.
  // Only setRefreshing(true) inside your onRefresh handler, and set it back to false in finally{}.
  // UI helpers
  const nameText =
    profile?.fullName ||
    profile?.name ||
    profile?.displayName ||
    profile?.nickname ||
    resolvedUsername ||
    '';

  const avatarUrl = toAvatarUrl(profile);
  const { followers, following } = toCounts(profile || {});

  const HeaderCounts = () => (
    <View style={styles.counters}>
      <TouchableOpacity
        style={styles.countItem}
        onPress={() => navigation.navigate('Following', { username: toUsername(profile), isSelf: true })}
      >
        <Text style={styles.countNum}>{following}</Text>
        <Text style={styles.countLbl}>Following</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.countItem}
        onPress={() => navigation.navigate('Followers', { username: toUsername(profile), isSelf: true })}
      >
        <Text style={styles.countNum}>{followers}</Text>
        <Text style={styles.countLbl}>Followers</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.profileTop}>
      <View style={styles.hero}>
        <Avatar uri={avatarUrl} name={nameText} username={resolvedUsername} />
        <Text style={styles.name}>{nameText}</Text>
        <Text style={styles.username}>@{resolvedUsername || ''}</Text>
        {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        <HeaderCounts />
        {/* {!loadingHeader && profile && (
          <View style={{ marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.pageBtn]}
              onPress={() => navigation?.navigate?.('EditProfile', { user: profile })}
            >
              <Text style={styles.pageBtnText}>Edit profile</Text>
            </TouchableOpacity>
          </View>
        )} */}
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

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F4FF' }}>
      <Header title={resolvedUsername ? `@${resolvedUsername}` : 'Profile'} />
      {loadingHeader && !resolvedUsername ? (
        <View style={styles.center}>
          <ActivityIndicator color="#6A1B9A" />
        </View>
      ) : (
        <FlatList
          data={tweets}
          keyExtractor={item => String(item._id || item.id)}
          renderItem={({ item }) => (
            <TweetCard
              tweet={item}
              onToggleLike={() => handleToggleLike(item._id || item.id)}
              onPress={() =>
                navigation.navigate('TweetDetail', { tweetId: item._id || item.id })
              }
            />
          )}
          ListHeaderComponent={renderHeader}
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
            REFRESH_ENABLED ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6A1B9A" />
            ) : undefined
          }
          // Disable auto-trigger; use only the button to avoid duplicate fetches/reset
          onEndReached={undefined}
          onEndReachedThreshold={undefined}
          onMomentumScrollBegin={undefined}
          contentContainerStyle={{ paddingBottom: 24 }}
          windowSize={7}
          initialNumToRender={10}
          removeClippedSubviews
        />
      )}

      {!!error && (
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
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#7E57C2' },
  pageBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#6A1B9A', borderRadius: 8 },
  pageBtnText: { color: '#FFF', fontWeight: '700' },
  errorBanner: { position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: '#FFE6E6', borderRadius: 8, padding: 10 },
  errText: { color: '#C62828', textAlign: 'center' },
  loadMoreBtn: { backgroundColor: '#EEE', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  loadMoreText: { color: '#4A148C', fontWeight: '700' },
});
