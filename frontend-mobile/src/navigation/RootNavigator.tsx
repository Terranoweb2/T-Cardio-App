import React, { useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../stores/authStore';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import HomeScreen from '../screens/main/HomeScreen';
import MeasurementsScreen from '../screens/main/MeasurementsScreen';
import AddMeasurementScreen from '../screens/main/AddMeasurementScreen';
import AnalysisScreen from '../screens/main/AnalysisScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import TeleconsultationsScreen from '../screens/main/TeleconsultationsScreen';
import TeleconsultationChatScreen from '../screens/main/TeleconsultationChatScreen';
import ReportsScreen from '../screens/main/ReportsScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Simple text-based tab icon component.
 * Avoids depending on icon libraries not in package.json.
 */
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={[tabIconStyles.icon, focused && tabIconStyles.iconFocused]}>
      {label}
    </Text>
  );
}

const tabIconStyles = StyleSheet.create({
  icon: { fontSize: 10, color: '#9ca3af', fontWeight: '600', textAlign: 'center' },
  iconFocused: { color: '#2563eb' },
});

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e5e7eb',
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ focused }) => <TabIcon label="[H]" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Measurements"
        component={MeasurementsScreen}
        options={{
          tabBarLabel: 'Mesures',
          tabBarIcon: ({ focused }) => <TabIcon label="[M]" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Add"
        component={AddMeasurementScreen}
        options={{
          tabBarLabel: 'Ajouter',
          tabBarIcon: ({ focused }) => <TabIcon label="[+]" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Teleconsultations"
        component={TeleconsultationsScreen}
        options={{
          tabBarLabel: 'Teleconsult.',
          tabBarIcon: ({ focused }) => <TabIcon label="[T]" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreStack}
        options={{
          tabBarLabel: 'Plus',
          tabBarIcon: ({ focused }) => <TabIcon label="[...]" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * "More" stack contains secondary screens: Analysis, Reports, Notifications, Profile.
 * This keeps the bottom tab bar at 5 items maximum for usability.
 */
const MoreStackNav = createStackNavigator();

function MoreStack() {
  return (
    <MoreStackNav.Navigator screenOptions={{ headerShown: false }}>
      <MoreStackNav.Screen name="MoreMenu" component={MoreMenuScreen} />
      <MoreStackNav.Screen name="Analysis" component={AnalysisScreen} />
      <MoreStackNav.Screen name="Reports" component={ReportsScreen} />
      <MoreStackNav.Screen name="Notifications" component={NotificationsScreen} />
      <MoreStackNav.Screen name="Profile" component={ProfileScreen} />
    </MoreStackNav.Navigator>
  );
}

/**
 * Menu screen listing additional features.
 */
function MoreMenuScreen({ navigation }: any) {
  const menuItems = [
    { key: 'Analysis', label: 'Analyse IA', icon: '[IA]', color: '#f59e0b' },
    { key: 'Reports', label: 'Rapports', icon: '[R]', color: '#dc2626' },
    { key: 'Notifications', label: 'Notifications', icon: '[N]', color: '#2563eb' },
    { key: 'Profile', label: 'Profil', icon: '[P]', color: '#6b7280' },
  ];

  return (
    <View style={moreStyles.container}>
      <Text style={moreStyles.title}>Plus</Text>
      {menuItems.map((item) => (
        <View key={item.key} style={moreStyles.menuItem}>
          <View style={[moreStyles.menuIcon, { backgroundColor: item.color + '15' }]}>
            <Text style={[moreStyles.menuIconText, { color: item.color }]}>{item.icon}</Text>
          </View>
          <View style={moreStyles.menuTextContainer}>
            <Text
              style={moreStyles.menuLabel}
              onPress={() => navigation.navigate(item.key)}
            >
              {item.label}
            </Text>
          </View>
          <Text style={moreStyles.menuArrow}>{'>'}</Text>
        </View>
      ))}
    </View>
  );
}

const moreStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
    paddingTop: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuIconText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  menuTextContainer: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  menuArrow: {
    fontSize: 18,
    color: '#d1d5db',
    fontWeight: 'bold',
  },
});

export default function RootNavigator() {
  const { isAuthenticated, isLoading, loadSession } = useAuthStore();

  useEffect(() => { loadSession(); }, []);

  if (isLoading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="TeleconsultationChat" component={TeleconsultationChatScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
