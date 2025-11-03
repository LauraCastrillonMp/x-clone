import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { searchUsers } from '../services/api';
import Header from '../components/Header';
import useAuth from '../hooks/useAuth';

const toUsername = (u) =>
  String(
    u?.username ??
      u?.handle ??
      u?.userName ??
      u?.name?.username ??
      u?.profile?.username ??
      ''
  ).toLowerCase();

export default function SearchScreen({ navigation }) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const { user: authUser, profile: authProfile } = useAuth?.() || {};
  const myUsername = toUsername(authProfile) || toUsername(authUser);

  // debounce 350ms
  const debouncedQ = useDebounce(q, 350);

  useEffect(() => {
    let alive = true;
    if (!debouncedQ.trim()) {
      setResults([]);
      setError('');
      return;
    }
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await searchUsers(debouncedQ.trim());
        const list = res?.results || res || [];
        if (alive) setResults(Array.isArray(list) ? list : []);
      } catch (e) {
        if (alive) {
          setResults([]);
          setError('Search failed');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [debouncedQ]);

  const handleSearch = async (q) => {
    const query = String(q || '').trim();
    setQ(query);

    // Don’t search for myself
    if (!query) return setResults([]);
    if (query.replace(/^@/, '').toLowerCase() === myUsername) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await searchUsers(query); // your existing API
      const list = Array.isArray(res?.users) ? res.users : Array.isArray(res) ? res : [];
      setResults(list);
    } catch (e) {
      // ...optional error state...
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  function openProfile(username) {
    const uname = String(username || '').toLowerCase();
    navigation.navigate('PublicProfile', { username: uname });
  }

  const renderItem = ({ item }) => {
    const uname = toUsername(item) || String(item.username || item.handle || '').toLowerCase();
    const isSelf = !!myUsername && uname === myUsername;
    const displayName = item.fullName || item.name || item.displayName || item.username || uname || 'Usuario';

    return (
      <TouchableOpacity style={styles.row} onPress={() => openProfile(uname)}>
        <Avatar uri={item.avatarUrl || item.avatar?.url || item.photoURL} name={displayName} />
        <View style={{ flex: 1 }}>
          <Text style={styles.fullName} numberOfLines={1}>{displayName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.username} numberOfLines={1}>@{uname}</Text>
            {isSelf && (
              <View style={styles.selfTag}>
                <Text style={styles.selfTagText}>You</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F4FF' }}>
      <Header title="Search" />
      <View style={styles.searchBox}>
        <TextInput
          placeholder="Search users by name or @username"
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          style={styles.input}
          returnKeyType="search"
        />
      </View>

      {loading && results.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color="#6A1B9A" />
        </View>
      ) : results.length === 0 && q.trim().length > 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>No users found</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, i) => item._id || item.username || String(i)}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 16 }}
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

function useDebounce(value, delay = 350) {
  const [v, setV] = useState(value);
  const tRef = useRef(null);
  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setV(value), delay);
    return () => clearTimeout(tRef.current);
  }, [value, delay]);
  return v;
}

function Avatar({ uri, size = 44, name = '' }) {
  const letter = (name?.[0] || 'U').toUpperCase();
  return (
    <View style={[styles.avatarWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={{ color: '#4A148C', fontWeight: '700' }}>{letter}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: { padding: 12 },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5DDF4',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 12,
    borderRadius: 10,
  },
  fullName: { color: '#4A148C', fontWeight: '700' },
  username: { color: '#7E57C2', marginTop: 2 },
  avatarWrap: { overflow: 'hidden', backgroundColor: '#EEE' },
  avatarFallback: { backgroundColor: '#E2D7F3', alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#7E57C2' },
  errorBanner: {
    position: 'absolute', left: 16, right: 16, bottom: 16, padding: 10,
    backgroundColor: '#FFE6E6', borderRadius: 8,
  },
  errText: { color: '#C62828', textAlign: 'center' },
  selfTag: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#EDE7F6',
  },
  selfTagText: {
    color: '#6A1B9A',
    fontWeight: '700',
    fontSize: 11,
  },
});