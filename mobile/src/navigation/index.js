import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Text, StyleSheet, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SearchScreen from '../screens/SearchScreen';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import FollowersScreen from '../screens/FollowersScreen';
import FollowingScreen from '../screens/FollowingScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';

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
        options={{ headerShown: false }}
      />
      {/* Add these so PublicProfile can navigate to them */}
      <SearchStackNav.Screen
        name="Followers"
        component={FollowersScreen}
        options={{ headerShown: false }}
      />
      <SearchStackNav.Screen
        name="Following"
        component={FollowingScreen}
        options={{ headerShown: false }}
      />
    </SearchStackNav.Navigator>
  );
}

/* ---------- TABS ---------- */

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#6A1B9A',
        tabBarInactiveTintColor: '#777',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Search') iconName = focused ? 'search' : 'search-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          // return the icon component
          return <Ionicons name={iconName} size={size ?? 24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Search" component={SearchStack} options={{ tabBarLabel: 'Search' }} />
      <Tab.Screen name="Profile" component={ProfileStack} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

/* ---------- MAIN ROUTER (AUTH / APP separado) ---------- */

export default function AppNavigation() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [username, setUsername] = useState(null);

  useEffect(() => {
    async function checkAuth() {
      const token = await AsyncStorage.getItem('idToken');
      if (token) setAuthToken(token); // make API include Authorization
      setIsAuthenticated(!!token);
      const storedUser = await AsyncStorage.getItem('username');
      setUsername(storedUser || null);
    }
    checkAuth();
  }, []);

  // Ensure header username updates when auth state changes (login/logout)
  useEffect(() => {
    async function refreshUsername() {
      try {
        if (isAuthenticated) {
          const storedUser = await AsyncStorage.getItem('username');
          setUsername(storedUser || null);
        } else {
          setUsername(null);
        }
      } catch (e) {
        setUsername(null);
      }
    }
    refreshUsername();
  }, [isAuthenticated]);

  async function handleLogout() {
    try {
      await AsyncStorage.removeItem('idToken');
      await AsyncStorage.removeItem('username'); // add this
      if (setAuthToken) setAuthToken(null);
    } catch {}
    setIsAuthenticated(false);
    setUsername(null);
  }

  // Add this small header component so it receives the current username
  function HeaderBrand({ navigation, username }) {
    return (
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center' }}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })}
        accessibilityLabel="Ir al inicio"
      >
        <Image source={require('../assets/logo.png')} style={{ width: 32, height: 32 }} />
        <View style={{ marginLeft: 8 }}>
          <Text style={{ fontWeight: '700', fontSize: 18, color: '#6A1B9A' }}> Orbyt</Text>
          {username ? (
            <Text style={{ fontSize: 12, color: '#666' }}>{`@${username}`}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
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
            // headerShown: false,
            contentStyle: { backgroundColor: '#ffffff' },
          }}
        >
          <Stack.Screen 
            name="Main" 
            component={MainTabs}
            options={({ navigation }) => ({
              headerShown: true,
              headerTitle: '',
              // use the HeaderBrand component so it receives the current username
              headerLeft: () => <HeaderBrand navigation={navigation} username={username} />,
              gestureEnabled: false,
              headerRight: () => (
                <TouchableOpacity
                  onPress={() => handleLogout()}
                  accessibilityLabel="Cerrar sesión"
                  style={{ paddingHorizontal: 8 }}
                >
                  <Ionicons name="log-out-outline" size={26} color="#6A1B9A" />
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
            {props => (
              <LoginScreen
                {...props}
                onAuthSuccess={async (uname) => {
                  if (uname) await AsyncStorage.setItem('username', uname);
                  setIsAuthenticated(true);
                  setUsername(uname ?? (await AsyncStorage.getItem('username')));
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Register">
            {props => (
              <RegisterScreen
                {...props}
                onAuthSuccess={async (uname) => {
                  if (uname) await AsyncStorage.setItem('username', uname);
                  setIsAuthenticated(true);
                  setUsername(uname ?? (await AsyncStorage.getItem('username')));
                }}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
