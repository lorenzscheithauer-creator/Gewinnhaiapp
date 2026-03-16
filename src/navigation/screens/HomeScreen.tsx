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
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useGiveaways } from '../../hooks/useGiveaways';
import { Giveaway } from '../../types/models';
import { isOfflineError, useRefetchOnFocus } from '../../utils/query';
import { openGiveawaySelection } from '../../utils/giveawayAction';
import { MainTabParamList, RootStackParamList } from '../types';

type HomeRouteProp = RouteProp<MainTabParamList, 'Home'>;
type DetailNavigation = NativeStackNavigationProp<RootStackParamList>;
type TabNavigation = BottomTabNavigationProp<MainTabParamList, 'Home'>;

export function HomeScreen() {
  const route = useRoute<HomeRouteProp>();
  const navigation = useNavigation<DetailNavigation>();
  const tabNavigation = useNavigation<TabNavigation>();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);

  const categoryId = route.params?.categoryId;
  const categoryTitle = route.params?.categoryTitle;
  const categorySlug = route.params?.categorySlug;

  const giveawaysQuery = useGiveaways({ query: debouncedQuery, categoryId, categorySlug });
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
          <Pressable
            onPress={() => tabNavigation.setParams({ categoryId: undefined, categorySlug: undefined, categoryTitle: undefined })}
            accessibilityRole="button"
            hitSlop={6}
          >
            <Text style={styles.filterAction}>Filter entfernen</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Suche Gewinnspiele"
          value={query}
          onChangeText={setQuery}
          style={styles.search}
          autoCapitalize="none"
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {query.length > 0 ? (
          <Pressable style={styles.clearButton} onPress={() => setQuery('')} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.clearLabel}>Reset</Text>
          </Pressable>
        ) : null}
      </View>
      {query.trim().length === 1 ? <Text style={styles.inlineHint}>Mindestens 2 Zeichen für die Suche eingeben.</Text> : null}
      {giveawaysQuery.isError && data.length > 0 ? (
        <Text style={styles.inlineWarning}>Offline-Modus: Es werden zuletzt geladene Live-Daten angezeigt.</Text>
      ) : null}
      <FlatList
        data={data}
        keyExtractor={(item) => `${item.id}:${item.slug}`}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={giveawaysQuery.isRefetching && !giveawaysQuery.isPending} onRefresh={() => giveawaysQuery.refetch()} />
        }
        ListEmptyComponent={<EmptyState title="Keine Treffer" message="Passe die Suche oder Filter an." onRetry={() => giveawaysQuery.refetch()} />}
        ListFooterComponent={giveawaysQuery.isFetching && !giveawaysQuery.isRefetching ? <ActivityIndicator style={styles.listLoader} /> : null}
        renderItem={({ item }: { item: Giveaway }) => (
          <GiveawayCard
            item={item}
            onPress={(selected) =>
              openGiveawaySelection(selected, (idOrSlug) => navigation.navigate('GiveawayDetail', { idOrSlug }))
            }
          />
        )}
      />
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  search: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  clearButton: {
    backgroundColor: '#dfeef3',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  clearLabel: {
    color: '#0a7ea4',
    fontWeight: '600'
  },
  inlineHint: {
    marginBottom: 10,
    color: '#50636d',
    fontSize: 12
  },
  inlineWarning: {
    marginBottom: 10,
    color: '#9b6a00',
    fontSize: 12
  },
  listLoader: {
    marginVertical: 12
  }
});
