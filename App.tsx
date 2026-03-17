import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { NavigationContainer, DefaultTheme, LinkingOptions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { CategoriesScreen } from './src/navigation/screens/CategoriesScreen';
import { GiveawayDetailScreen } from './src/navigation/screens/GiveawayDetailScreen';
import { HomeScreen } from './src/navigation/screens/HomeScreen';
import { Top10Screen } from './src/navigation/screens/Top10Screen';
import { SearchScreen } from './src/navigation/screens/SearchScreen';
import { MainTabParamList, RootStackParamList } from './src/navigation/types';
import { log } from './src/utils/logger';

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
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst'
    }
  }
});

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function parseForegroundState(status: AppStateStatus): boolean {
  return status === 'active';
}

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['gewinnhai://', 'https://gewinnhai.de', 'https://www.gewinnhai.de'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Home: 'home',
          Categories: 'categories',
          Top10: 'top10',
          Search: 'suche'
        }
      },
      GiveawayDetail: {
        path: 'gewinnspiel/:idOrSlug',
        parse: {
          idOrSlug: (value: string) => decodeURIComponent(value).trim()
        }
      }
    }
  }
};

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
      initialRouteName="Home"
      screenOptions={{
        headerTitleStyle: { fontWeight: '700' },
        tabBarLabelStyle: { fontSize: 12 },
        tabBarHideOnKeyboard: true
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'Start' }} />
      <Tabs.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Kategorien' }} />
      <Tabs.Screen name="Top10" component={Top10Screen} options={{ title: 'Top10' }} />
      <Tabs.Screen name="Search" component={SearchScreen} options={{ title: 'Suche' }} />
    </Tabs.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    const updateFocus = (status: AppStateStatus) => {
      const isActive = parseForegroundState(status);
      focusManager.setFocused(isActive);

      if (isActive) {
        log('debug', 'App returned to foreground. Refetching active queries.');
        void queryClient.refetchQueries({ type: 'active' });
      }
    };

    updateFocus(AppState.currentState);
    const subscription = AppState.addEventListener('change', updateFocus);

    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer theme={navTheme} linking={linking} fallback={null}>
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
