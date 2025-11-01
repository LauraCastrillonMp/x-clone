import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as api from '../services/api';

export default function FollowButton({ targetUsername, initialFollowing=false, onChange }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  useEffect(()=> {
    setFollowing(initialFollowing);
  }, [initialFollowing]);

  async function toggle() {
    setLoading(true);
    try {
      if (following) {
        const res = await api.unfollowUser(targetUsername);
        if (res && (res.message || res.ok)) {
          setFollowing(false);
          if (onChange) onChange(false);
        }
      } else {
        const res = await api.followUser(targetUsername);
        if (res && (res.message || res.ok)) {
          setFollowing(true);
          if (onChange) onChange(true);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <TouchableOpacity style={[styles.btn, following ? styles.following : styles.notFollowing]} onPress={toggle} disabled={loading}>
      <Text style={styles.text}>{following ? 'Following' : 'Follow'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal:12, paddingVertical:8, borderRadius:8 },
  following: { backgroundColor:'#F8F4FF', borderWidth:1, borderColor:'#6A1B9A' },
  notFollowing: { backgroundColor:'#6A1B9A' },
  text: { color:'#fff', fontWeight:'700' }
});
