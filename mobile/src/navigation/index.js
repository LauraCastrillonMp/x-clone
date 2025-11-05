import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SearchScreen from '../screens/SearchScreen';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import FollowersScreen from '../screens/FollowersScreen';
import FollowingScreen from '../screens/FollowingScreen';

// Screens
import HomeScreen from '../screens/HomeScreen';
import ComposeScreen from '../screens/ComposeScreen';
// import NotificationsScreen from '../screens/NotificationsScreen';
// import SavedScreen from '../screens/SavedScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TweetDetailScreen from '../screens/TweetDetailScreen';
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import { setAuthToken } from '../services/api';
import { auth } from '../services/firebase';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/* ---------- STACKS ---------- */

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="TweetDetail" component={TweetDetailScreen} />
      <Stack.Screen name="Compose" component={ComposeScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator>
      {/* Profile flow */}
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TweetDetail" component={TweetDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Followers" component={FollowersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Following" component={FollowingScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

const SearchStackNav = createNativeStackNavigator();

function SearchStack() {
  return (
    <SearchStackNav.Navigator>
      <SearchStackNav.Screen
        name="SearchHome"
        component={SearchScreen}
        options={{ headerShown: false }}
      />
      <SearchStackNav.Screen
        name="PublicProfile"
        component={PublicProfileScreen}
        options={{ title: 'Profile' }}
      />
      {/* Add these so PublicProfile can navigate to them */}
      <SearchStackNav.Screen
        name="Followers"
        component={FollowersScreen}
        options={{ title: 'Followers' }}
      />
      <SearchStackNav.Screen
        name="Following"
        component={FollowingScreen}
        options={{ title: 'Following' }}
      />
    </SearchStackNav.Navigator>
  );
}

/* ---------- TABS ---------- */

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6A1B9A',
      }}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      {/* <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Saved" component={SavedScreen} /> */}
      <Tab.Screen name="Search" component={SearchStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

/* ---------- MAIN ROUTER (AUTH / APP separado) ---------- */

export default function AppNavigation() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    async function checkAuth() {
      const token = await AsyncStorage.getItem('idToken');
      if (token) setAuthToken(token); // make API include Authorization
      setIsAuthenticated(!!token);
    }
    checkAuth();
  }, []);

  async function handleLogout() {
    try {
      await AsyncStorage.removeItem('idToken');
      await AsyncStorage.removeItem('username'); // add this
      if (setAuthToken) setAuthToken(null);
    } catch {}
    setIsAuthenticated(false);
  }

  if (isAuthenticated === null) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator size="large" color="#6A1B9A" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        // flujo de la app: aquí NO están Login/Register => imposible volver a ellas
        <Stack.Navigator 
          initialRouteName="Main"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#ffffff' },
          }}
        >
          <Stack.Screen 
            name="Main" 
            component={MainTabs}
            options={({ navigation }) => ({
              headerShown: true,
              headerTitle: '',
              // asegurar que no haya botón "volver" ni gestos que regresen al auth
              headerLeft: () => null,
              gestureEnabled: false,
              headerRight: () => (
                <TouchableOpacity
                  style={styles.logoutBtn}
                  onPress={() => handleLogout()}
                  accessibilityLabel="Cerrar sesión"
                >
                  <Text style={styles.logoutText}>🔒</Text>
                </TouchableOpacity>
              ),
            })}
          />
        </Stack.Navigator>
      ) : (
        // flujo de auth: aquí solo Login/Register
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#ffffff' },
          }}
        >
          <Stack.Screen name="Login">
            {props => <LoginScreen {...props} onAuthSuccess={() => setIsAuthenticated(true)} />}
          </Stack.Screen>
          <Stack.Screen name="Register">
            {props => <RegisterScreen {...props} onAuthSuccess={() => setIsAuthenticated(true)} />}
          </Stack.Screen>
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  logoutBtn: {
    marginRight: 12,
    padding: 6,
  },
  logoutText: {
    fontSize: 20,
  },
});
