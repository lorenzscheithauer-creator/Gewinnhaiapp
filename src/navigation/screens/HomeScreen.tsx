import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { GiveawayCard } from '../../components/GiveawayCard';
import { LoadingState } from '../../components/LoadingState';
import { OfflineState } from '../../components/OfflineState';
import { useGiveaways } from '../../hooks/useGiveaways';
import { Giveaway } from '../../types/models';
import { useRefetchOnFocus, isOfflineError } from '../../utils/query';
import { MainTabParamList, RootStackParamList } from '../types';

type HomeRouteProp = RouteProp<MainTabParamList, 'Home'>;
type DetailNavigation = NativeStackNavigationProp<RootStackParamList>;
type TabNavigation = BottomTabNavigationProp<MainTabParamList, 'Home'>;

export function HomeScreen() {
  const route = useRoute<HomeRouteProp>();
  const navigation = useNavigation<DetailNavigation>();
  const tabNavigation = useNavigation<TabNavigation>();
  const [query, setQuery] = useState('');

  const categoryId = route.params?.categoryId;
  const categoryTitle = route.params?.categoryTitle;

  const giveawaysQuery = useGiveaways({ query, categoryId });
  useRefetchOnFocus(giveawaysQuery.refetch);

  const data = useMemo(() => giveawaysQuery.data ?? [], [giveawaysQuery.data]);
  const offline = isOfflineError(giveawaysQuery.error);

  if (giveawaysQuery.isPending && !Array.isArray(giveawaysQuery.data)) {
    return <LoadingState label="Gewinnspiele werden geladen…" />;
  }

  if (giveawaysQuery.isError && !Array.isArray(giveawaysQuery.data)) {
    if (offline) return <OfflineState message={(giveawaysQuery.error as Error).message} onRetry={() => giveawaysQuery.refetch()} />;
    return <ErrorState message={(giveawaysQuery.error as Error).message} onRetry={() => giveawaysQuery.refetch()} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Aktuelle Gewinnspiele</Text>
      {categoryTitle ? (
        <View style={styles.filterInfoContainer}>
          <Text style={styles.filterInfo}>Filter aktiv: {categoryTitle}</Text>
          <Pressable onPress={() => tabNavigation.setParams({ categoryId: undefined, categoryTitle: undefined })}>
            <Text style={styles.filterAction}>Filter entfernen</Text>
          </Pressable>
        </View>
      ) : null}
      <TextInput placeholder="Suche Gewinnspiele" value={query} onChangeText={setQuery} style={styles.search} autoCapitalize="none" />
      {giveawaysQuery.isError && data.length > 0 ? (
        <Text style={styles.inlineWarning}>Offline-Modus: Es werden zuletzt geladene Live-Daten angezeigt.</Text>
      ) : null}
      <FlatList
        data={data}
        keyExtractor={(item, index) => `${item.id}:${item.slug}:${index}`}
        refreshControl={
          <RefreshControl refreshing={giveawaysQuery.isRefetching && !giveawaysQuery.isPending} onRefresh={() => giveawaysQuery.refetch()} />
        }
        ListEmptyComponent={<EmptyState title="Keine Treffer" message="Passe die Suche oder Filter an." onRetry={() => giveawaysQuery.refetch()} />}
        renderItem={({ item }: { item: Giveaway }) => (
          <GiveawayCard
            item={item}
            onPress={(selected) => navigation.navigate('GiveawayDetail', { idOrSlug: selected.slug || selected.id })}
          />
        )}
      />
      {giveawaysQuery.isFetching && !giveawaysQuery.isRefetching ? <ActivityIndicator style={styles.fetchingIndicator} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fb',
    padding: 12
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10
  },
  filterInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  filterInfo: {
    fontWeight: '600',
    color: '#0a7ea4'
  },
  filterAction: {
    color: '#0a7ea4',
    textDecorationLine: 'underline'
  },
  search: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12
  },
  inlineWarning: {
    marginBottom: 10,
    color: '#9b6a00',
    fontSize: 12
  },
  fetchingIndicator: {
    position: 'absolute',
    top: 8,
    right: 12
  }
});
