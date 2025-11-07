import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, FlatList } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { PermissionsAndroid, Platform } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { uploadToCloudinary, postTweet } from '../services/api';
import Header from '../components/Header';

const MAX_TWEET_CHARS = 280;

export default function ComposeScreen({ route, navigation }) {
  const [text, setText] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [images, setImages] = useState([]); // [{ uri, width, height }]
  const [mediaUris, setMediaUris] = React.useState([]);

  const remaining = useMemo(() => MAX_TWEET_CHARS - (text?.length || 0), [text]);
  const canPost = text.trim().length > 0 && text.length <= MAX_TWEET_CHARS;

  const MAX_PHOTOS = 4;

  async function requestGalleryPermission() {
    if (Platform.OS !== 'android') return true;
    try {
      const perm =
        Platform.Version >= 33
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
      const granted = await PermissionsAndroid.request(perm);
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }

  const pickImages = async () => {
    const ok = await requestGalleryPermission();
    if (!ok) {
      Alert.alert('Permisos', 'Autoriza el acceso a tus fotos para adjuntar imágenes.');
      return;
    }
    const limit = Math.max(1, MAX_PHOTOS - images.length);
    const res = await launchImageLibrary({ mediaType: 'photo', selectionLimit: limit, quality: 0.9 });
    if (res.didCancel) return;
    const assets = Array.isArray(res.assets) ? res.assets : [];
    const next = assets.map(a => ({ uri: a.uri, width: a.width, height: a.height })).filter(a => !!a.uri);
    setImages(prev => [...prev, ...next].slice(0, MAX_PHOTOS));
    setMediaUris(assets.map(a => a.uri).filter(Boolean));
  };

  const removeImageAt = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setMediaUris(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePost = async () => {
    const body = text.trim();
    if (!body && images.length === 0) {
      Alert.alert('Vacío', 'Escribe algo o añade una foto');
      return;
    }
    try {
      setPublishing(true);
      // Upload images to Cloudinary (secuencial para simplificar)
      const uploaded = [];
      for (const img of images) {
        const up = await uploadToCloudinary(img.uri, { folder: 'tweets', type: 'image/jpeg' });
        const url =
          up?.secure_url ||
          up?.url ||
          (typeof up === 'string' ? up : null);
        if (url) uploaded.push(url);
      }

      // prefer uploaded cloud URLs; never send local URIs (mediaUris)
      const media = uploaded.length ? uploaded : [];
      await postTweet({ text: body, media });
      setText(''); setImages([]); setMediaUris([]);
      Alert.alert('Publicado', 'Tu orby ha sido publicado con éxito.');
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('MainTabs', { screen: 'Home' });
    } catch (e) {
      console.warn('post tweet error', e);
      Alert.alert('Error', e?.message || 'No se pudo publicar el tweet');
    } finally {
      setPublishing(false);
    }
  };

  const renderThumb = ({ item, index }) => (
    <View style={styles.thumbWrap}>
      <Image source={{ uri: item.uri }} style={styles.thumb} />
      <TouchableOpacity style={styles.removeBtn} onPress={() => removeImageAt(index)}>
        <Ionicons name="close" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF' }}>
      <Header title="Make a orby" />
      <View style={{ padding: 12 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="What's happening?"
          multiline
          style={styles.input}
          maxLength={MAX_TWEET_CHARS}
        />

        {images.length > 0 && (
          <FlatList
            data={images}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderThumb}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 8 }}
          />
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={pickImages}>
            <Ionicons name="image-outline" size={22} color="#6A1B9A" />
            <Text style={styles.iconText}>{images.length}/{MAX_PHOTOS}</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={[styles.postBtn, !(text.trim() || images.length) && { opacity: 0.5 }]}
            onPress={handlePost}
            disabled={!(text.trim() || images.length)}
          >
            <Text style={styles.postText}>{publishing ? 'Publishing...' : 'Publish'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <Text>{text.length}/{MAX_TWEET_CHARS}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 100, fontSize: 16, color: '#111', textAlignVertical: 'top' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  iconBtn: { flexDirection: 'row', alignItems: 'center' },
  iconText: { marginLeft: 6, color: '#6A1B9A', fontWeight: '600' },
  postBtn: { backgroundColor: '#6A1B9A', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20 },
  postText: { color: '#fff', fontWeight: '700' },
  thumbWrap: { marginRight: 8, position: 'relative' },
  thumb: { width: 96, height: 96, borderRadius: 8, backgroundColor: '#f2f2f2' },
  removeBtn: {
    position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10, padding: 2,
  },
});
