import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import TweetCard from '../components/TweetCard';
import { getFeed, toggleLike, getMyProfile, getFollowing } from '../services/api';

export default function HomeScreen({ navigation }) {
  const PAGE_SIZE = 10;

  // Hooks grouped up front to preserve call order
  const [tweets, setTweets] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'following'
  // deterministic followings/current user ids for robust filtering
  const [followingIds, setFollowingIds] = useState(new Set());
  const [currentUserId, setCurrentUserId] = useState(null);
  const likeLocks = useRef(new Set());

  // helper to detect replies / comments (avoid undefined error)
  const looksLikeReply = (t) =>
    Boolean(
      t.parentId ||
      t.parent ||
      t.replyTo ||
      t.inReplyToId ||
      t.isReply ||
      t.__local ||
      t.type === 'reply' ||
      t.type === 'comment' ||
      (t.rootId && String(t.rootId) !== String(t._id || t.id))
    );

  // helper to pick author id from many possible shapes
  const getAuthorId = (t) =>
    (t.author && (t.author.id || t.author._id)) ||
    (t.user && (t.user.id || t.user._id)) ||
    (t.fromUser && (t.fromUser.id || t.fromUser._id)) ||
    t.creatorId ||
    t.ownerId ||
    t.userId ||
    t.user_id ||
    null;

  // new: robust author handle/username extractor (used for matching when ids differ)
  const getAuthorHandle = (t) =>
    (t.author && (t.author.username || t.author.handle || t.author.userName)) ||
    (t.user && (t.user.username || t.user.handle || t.user.userName)) ||
    (t.fromUser && (t.fromUser.username || t.fromUser.handle || t.fromUser.userName)) ||
    t.username ||
    t.handle ||
    null;

  // new: stable key generator for tweets (avoid colliding "undefined" keys)
  const getTweetKey = (t) => {
    if (!t) return '';
    const id = t._id || t.id || t.id_str || t.clientId || t.localId;
    if (id) return String(id);
    // fall back to createdAt + snippet to reasonably identify items without id
    const time = String(t.createdAt || t.created_at || t.ts || '');
    const snippet = String((t.text || t.body || t.content || '').slice(0, 40));
    return `${time}|${snippet}`;
  };

  const isFromFollowed = (t) => {
    const authorId = getAuthorId(t);
    if (authorId) {
      const sId = String(authorId);
      if (currentUserId && sId === String(currentUserId)) return true;
      if (followingIds && followingIds.has(sId)) return true;
    }

    // fallback to common boolean flags if IDs not present
    return Boolean(
      t.isMine ||
      t.mine ||
      t.ownedByCurrentUser ||
      t.isFollowing ||
      t.is_following ||
      t.author?.isFollowed ||
      t.author?.is_followed ||
      t.author?.isFollowing ||
      t.author?.is_following ||
      t.author?.followedByCurrentUser ||
      t.author?.followed_by_current_user ||
      t.author?.followed ||
      t.author?.following ||
      t.user?.isFollowed ||
      t.user?.is_followed ||
      t.user?.isFollowing ||
      t.fromUser?.isFollowed ||
      t.fromUser?.is_followed ||
      t.fromUser?.isFollowing ||
      t.viewerIsFollowing ||
      t.viewer_is_following
    );
  };

  // load followings/current user id when user picks the "following" filter
  useEffect(() => {
    // Only load when user selects "following". Attempt to use app service helpers first,
    // gracefully fall back and continue even if followings fetch fails.
    if (filter !== 'following') return;
    let mounted = true;
    const loadFollowings = async () => {
      try {
        // Prefer service helpers which know auth/session shapes
        let me = null;
        try {
          me = await getMyProfile();
        } catch (err) {
          // fallback: ignore
        }
        if (!mounted) return;
        // normalize possible shapes: { user }, { data: { user } }, or user object itself
        const meUser = me?.user ?? me?.data?.user ?? me?.data ?? me;
        const meId = meUser ? (meUser.id || meUser._id || meUser.userId || null) : null;
        if (meUser) setCurrentUserId(meId);

        // fetch followings for the resolved username (use API helper)
        let followList = null;
        try {
          const username = meUser?.username || meUser?.handle || meUser?.userName;
          if (username) {
            const res = await getFollowing(username);
            followList = Array.isArray(res?.results) ? res.results : res?.results || res?.items || res?.data || res;
          }
        } catch (err) {
          // ignore - we'll fall back to boolean flags
        }

        if (!mounted) return;
        const arr = Array.isArray(followList) ? followList : [];

        // robust extraction: handles many shapes like { id }, { _id }, { user: { id } }, { following: { id } }, etc.
        const extractId = (u) => {
          if (!u) return null;
          if (typeof u === 'string' || typeof u === 'number') return String(u);
          const cand =
            u.id || u._id || u.userId || u.accountId ||
            u.user?.id || u.user?._id || u.user?.userId ||
            u.following?.id || u.following?._id || u.following?.userId ||
            u.to?.id || u.to?._id || u.to?.userId ||
            u.followed?.id || u.followed?._id || u.followed?.userId;
          return cand ? String(cand) : null;
        };

        const ids = new Set(arr.map(extractId).filter(Boolean));
        // always include current user id so "following" includes your own tweets
        if (meId) ids.add(String(meId));

        // set deterministic set for later UI checks
        setFollowingIds(ids);

        // after populating a local set, load feed immediately and use that set (avoids race with setState)
        if (mounted) {
          // call loadFeed with local ids so filtering happens immediately
          await loadFeed(1, 'following', ids, meId);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[HomeScreen] loadFollowings failed', err);
        if (mounted) setFollowingIds(new Set());
        if (mounted) loadFeed(1, 'following').catch(()=>{});
      }
    };

    loadFollowings();
    return () => { mounted = false; };
  }, [filter]);

  const loadFeed = async (p = 1, f = filter, localFollowingIds = null, localCurrentUserId = null) => {
    // guard concurrent loads
    if ((p === 1 && loading) || (p > 1 && loadingMore)) return;
    try {
      p === 1 ? setLoading(true) : setLoadingMore(true);

      // We'll accumulate filtered items for this "page" if client-side filtering reduces results.
      let collected = [];
      let serverPage = p;
      let serverHasMore = true;
      const maxExtraPages = 6; // prevent unbounded loops; tune as needed
      let extraPagesFetched = 0;

      const usedFollowingIds = localFollowingIds ?? followingIds;
      const usedCurrentUserId = localCurrentUserId ?? currentUserId;

      // loop to fetch server pages until we have PAGE_SIZE items after client-side filtering
      while (collected.length < PAGE_SIZE && serverHasMore && extraPagesFetched < maxExtraPages) {
        // pass filter to the API if supported. server should accept e.g. { filter: 'following' }
        const res = await getFeed(serverPage, PAGE_SIZE, { filter: f === 'following' ? 'following' : 'all' });

        // normalize many server shapes
        const raw =
          (Array.isArray(res) && res) ||
          res?.tweets ||
          res?.data?.tweets ||
          res?.results ||
          res?.items ||
          res?.data ||
          [];
        const list = Array.isArray(raw) ? raw : [];
        const total = Number.isFinite(res?.total) ? res.total : undefined;

        // eslint-disable-next-line no-console
        console.log('[HomeScreen] loadFeed', { requestedPage: p, serverPage, filter: f, currentUserId, followingCount: followingIds?.size });
        // eslint-disable-next-line no-console
        console.log('[HomeScreen] raw list sample', list.slice(0,3).map(r => ({
          id: r?.id || r?._id,
          authorId: getAuthorId(r),
          authorHandle: getAuthorHandle(r),
          keys: Object.keys(r || {}).slice(0,20)
        })));

        // exclude replies so feed only shows top-level tweets
        let topLevel = list.filter(t => !looksLikeReply(t));

        // client-side fallback: if filtering for following and server didn't do it, filter by common flags
        if (f === 'following') {
          topLevel = topLevel.filter(t => {
            const authorId = getAuthorId(t);
            const authorHandle = (getAuthorHandle(t) || '').toLowerCase();

            if (authorId) {
              const sId = String(authorId);
              if (usedCurrentUserId && sId === String(usedCurrentUserId)) return true;
              if (usedFollowingIds && typeof usedFollowingIds.has === 'function' && usedFollowingIds.has(sId)) return true;
            }

            // also match by handle/username against following set (we store handles too)
            if (authorHandle && usedFollowingIds && typeof usedFollowingIds.has === 'function' && usedFollowingIds.has(authorHandle)) return true;
            if (authorHandle && usedCurrentUserId && String(authorHandle) === String((usedCurrentUserId || '')).toLowerCase()) return true;

            // fallback to boolean flags if IDs/handles not present or didn't match
            return Boolean(
              t.isMine ||
              t.mine ||
              t.ownedByCurrentUser ||
              t.isFollowing ||
              t.is_following ||
              t.author?.isFollowed ||
              t.author?.is_followed ||
              t.author?.isFollowing ||
              t.author?.is_following ||
              t.author?.followedByCurrentUser ||
              t.author?.followed_by_current_user ||
              t.author?.followed ||
              t.author?.following ||
              t.user?.isFollowed ||
              t.user?.is_followed ||
              t.user?.isFollowing ||
              t.fromUser?.isFollowed ||
              t.fromUser?.is_followed ||
              t.fromUser?.isFollowing ||
              t.viewerIsFollowing ||
              t.viewer_is_following
            );
          });
        }

        // append filtered page results, preserving order
        for (const t of topLevel) {
          if (collected.length >= PAGE_SIZE) break;
          collected.push(t);
        }

        // determine if server signalled more pages
        serverHasMore =
          typeof res?.hasMore === 'boolean' ? res.hasMore
            : typeof res?.data?.hasMore === 'boolean' ? res.data.hasMore
            : typeof res?.pagination?.hasMore === 'boolean' ? res.pagination.hasMore
            : (total ? serverPage * PAGE_SIZE < total : list.length >= PAGE_SIZE);

        // prepare for next server page if we still need items
        if (collected.length < PAGE_SIZE && serverHasMore) {
          serverPage += 1;
          extraPagesFetched += 1;
        } else {
          break;
        }
      }

      // dedupe and set into state (merge for pages > 1)
      if (p === 1) {
        setTweets(collected);
      } else {
        setTweets(prev => {
          const map = new Map(prev.map(t => [getTweetKey(t), t]));
          for (const t of collected) map.set(getTweetKey(t), t);
          return Array.from(map.values());
        });
      }

      setPage(p);

      // decide hasMore for UI: if we couldn't fill PAGE_SIZE and server exhausted -> no more
      const nextHasMore = serverHasMore && collected.length >= PAGE_SIZE;
      setHasMore(!!nextHasMore);
    } catch (err) {
      console.warn('loadFeed error', err?.message || err);
      if (p === 1) setTweets([]);
      setHasMore(false);
    } finally {
      if (p === 1) {
        setLoading(false);
        setRefreshing(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  // when switching to non-following filters, just load feed immediately.
  useEffect(() => {
    if (filter === 'following') return;
    loadFeed(1, filter);
  }, [filter]);

  const onRefresh = () => {
    setRefreshing(true);
    setHasMore(true);
    loadFeed(1, filter);
  };

  // Improved load more: compute next page from current state, avoid pre-incrementing page,
  // guard against concurrent calls via loadingMore flag.
  const handleLoadMore = () => {
    if (!hasMore || loadingMore || loading) return;
    const next = page + 1;
    loadFeed(next, filter).catch(err => console.warn('handleLoadMore error', err));
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
    <View style={{ flex: 1, backgroundColor: '#eadeffff' }}>
      <TouchableOpacity style={styles.composeBtn} onPress={() => navigation.navigate('Compose')}>
        <Text style={styles.composeText}>Orby</Text>
      </TouchableOpacity>

      {/* Filter */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginHorizontal: 12 }}>
        <TouchableOpacity
          onPress={() => { if (filter !== 'all') { setFilter('all'); setHasMore(true); } }}
          style={[styles.filterBtn, filter === 'all' && styles.filterActive]}
        >
          <Text style={filter === 'all' ? styles.filterActiveText : styles.filterText}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { if (filter !== 'following') { setFilter('following'); setHasMore(true); } }}
          style={[styles.filterBtn, filter === 'following' && styles.filterActive]}
        >
          <Text style={filter === 'following' ? styles.filterActiveText : styles.filterText}>Following</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tweets}
        keyExtractor={item => String(item._id || item.id)}
        renderItem={renderItem}
        // Show footer when there are items OR when loading more / more available.
        ListFooterComponent={() => (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            {loadingMore ? (
              <ActivityIndicator color="#6A1B9A" />
            ) : hasMore ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore} disabled={loadingMore}>
                <Text style={styles.loadMoreText}>Load more</Text>
              </TouchableOpacity>
            ) : tweets.length > 0 ? (
              <Text style={styles.muted}>No more</Text>
            ) : null}
          </View>
        )}
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

  // filter styles
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    margin: 6,
    backgroundColor: 'transparent',
  },
  filterActive: {
    backgroundColor: '#6A1B9A',
  },
  filterText: {
    color: '#333',
    fontWeight: '600',
  },
  filterActiveText: {
    color: '#fff',
    fontWeight: '700',
  },
});
