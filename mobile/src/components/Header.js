import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function Header({ title }) {
  const navigation = useNavigation();
  const canGoBack = navigation?.canGoBack?.() ?? false;

  return (
    <View style={styles.container}>
      {canGoBack ? (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>
            <Ionicons name="arrow-back-outline" size={22} color="#6A1B9A" />
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.spacer} />
      )}
      <Text numberOfLines={1} style={styles.title}>{title || ''}</Text>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eadeff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: { minWidth: 64 },
  backText: { color: '#6A1B9A', fontWeight: '700' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#333' },
  spacer: { width: 64 },
});
