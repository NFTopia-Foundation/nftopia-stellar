import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type MainStackParamList = {
  Home: undefined;
  Marketplace: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

// Placeholder screen for development
function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Coming Soon</Text>
    </View>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Home">
        {(props) => <PlaceholderScreen {...props} title="Home" />}
      </Stack.Screen>
      <Stack.Screen name="Marketplace">
        {(props) => <PlaceholderScreen {...props} title="Marketplace" />}
      </Stack.Screen>
      <Stack.Screen name="Profile">
        {(props) => <PlaceholderScreen {...props} title="Profile" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
