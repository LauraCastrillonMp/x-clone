import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
export default function Header({ title, username, onLogout, onBack }) {
  return (
    <View style={styles.container}>
      {onBack ? <TouchableOpacity onPress={onBack}><Text style={styles.link}>Back</Text></TouchableOpacity> : <View style={{width:50}}/>}
      <Text style={styles.title}>{title}</Text>
      {username ? (
        <TouchableOpacity onPress={onLogout}><Text style={styles.link}>{username} | Logout</Text></TouchableOpacity>
      ) : <View style={{width:50}}/>}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { height:60, paddingHorizontal:12, flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#F8F4FF' },
  title: { fontSize:18, fontWeight:'700', color:'#6A1B9A' },
  link: { color:'#FF7043', fontWeight:'600' }
});
