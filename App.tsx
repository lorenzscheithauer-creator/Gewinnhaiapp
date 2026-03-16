import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
      retry: 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false
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
