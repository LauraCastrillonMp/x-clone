import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons'; // vector icons

function toName(t) {
  const u = t?.user || t?.author || {};
  return (
    u.fullName ||
    u.name ||
    t.authorName ||
    t.name ||
    'Anónimo'
  );
}

function toUsername(t) {
  const u = t?.user || t?.author || {};
  return (
    u.username ||
    u.handle ||
    t.username ||
    t.handle ||
    'usuario'
  );
}

function toCreatedAt(t) {
  const val = t?.createdAt || t?.created_at || t?.timestamp || t?.date || null;
  if (!val) return null;
  let ms = typeof val === 'number' ? val : Date.parse(val);
  if (typeof val === 'number' && val < 1e12) ms = val * 1000; // seconds -> ms
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDateTime(d) {
  try {
    return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return d.toISOString();
  }
}

function toBody(t) {
  return String(t?.text ?? t?.content ?? t?.body ?? '').trim();
}

export default function TweetCard({ tweet, onToggleLike, onPress, onOpenComments }) {
  const name = toName(tweet);
  const username = toUsername(tweet);
  const created = toCreatedAt(tweet);
  const when = created ? fmtDateTime(created) : '';
  const body = toBody(tweet);

  const media = Array.isArray(tweet?.media)
    ? tweet.media
    : tweet?.media
    ? [tweet.media]
    : [];

  const liked = !!tweet?.likedByCurrentUser;
  const likesCount = Number.isFinite(tweet?.likesCount) ? tweet.likesCount : 0;
  const commentsCount = Number.isFinite(tweet?.commentsCount)
    ? tweet.commentsCount
    : Number.isFinite(tweet?.repliesCount)
    ? tweet.repliesCount
    : 0;

  const id = tweet?._id || tweet?.id;

  const ContentWrapper = onPress ? TouchableOpacity : View;

  return (
    <ContentWrapper style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.header}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.headerRest}>, @{username}{when ? ` - ${when}` : ''}</Text>
      </Text>

      {!!body && <Text style={styles.text}>{body}</Text>}

      {tweet.media && Array.isArray(tweet.media) && tweet.media.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {tweet.media.map((url, idx) => (
            <Image
              key={idx}
              source={{ uri: url }}
              style={{ width: 240, height: 240, borderRadius: 8, marginRight: 8, marginBottom: 8 }}
              resizeMode="cover"
            />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.7}
          onPress={() => onToggleLike && id && onToggleLike(id)}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={20}
            color={liked ? '#E0245E' : '#444'}
            style={styles.icon}
          />
          <Text style={styles.count}>{likesCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.7}
          onPress={() => onOpenComments && id && onOpenComments(id)}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#444" style={styles.icon} />
          <Text style={styles.count}>{commentsCount}</Text>
        </TouchableOpacity>
      </View>
    </ContentWrapper>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, borderBottomWidth: 1, borderColor: '#eee', backgroundColor: '#FFF' },
  header: { marginBottom: 6 },
  name: { fontSize: 15, color: '#111', fontWeight: '700' },
  headerRest: { fontSize: 13, color: '#555' },
  text: { fontSize: 15, color: '#111' },
  mediaWrap: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap' },
  image: { width: 200, height: 120, borderRadius: 8, marginRight: 8, marginBottom: 8, backgroundColor: '#f2f2f2' },

  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 18 },
  icon: { marginRight: 6 },
  count: { fontSize: 14, color: '#444' },
});
