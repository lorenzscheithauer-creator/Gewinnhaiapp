import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { CategoriesScreen } from './src/navigation/screens/CategoriesScreen';
import { GiveawayDetailScreen } from './src/navigation/screens/GiveawayDetailScreen';
import { HomeScreen } from './src/navigation/screens/HomeScreen';
import { Top10Screen } from './src/navigation/screens/Top10Screen';
import { MainTabParamList, RootStackParamList } from './src/navigation/types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        if (message.includes('nicht gefunden')) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      refetchOnReconnect: true,
      refetchOnWindowFocus: true
    }
  }
});

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f7f9fb'
  }
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerTitleStyle: { fontWeight: '700' },
        tabBarLabelStyle: { fontSize: 12 }
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'Start' }} />
      <Tabs.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Kategorien' }} />
      <Tabs.Screen name="Top10" component={Top10Screen} options={{ title: 'Top10' }} />
    </Tabs.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      const isActive = status === 'active';
      focusManager.setFocused(isActive);

      if (isActive) {
        queryClient.invalidateQueries({
          predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] !== 'giveaway-detail'
        });
      }
    });

    queryClient.invalidateQueries();

    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="dark" />
          <Stack.Navigator>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="GiveawayDetail" component={GiveawayDetailScreen} options={{ title: 'Gewinnspiel' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
