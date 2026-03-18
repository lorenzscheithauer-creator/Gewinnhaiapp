import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { BrandHeader } from '../../components/BrandHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { GiveawayCard } from '../../components/GiveawayCard';
import { LoadingState } from '../../components/LoadingState';
import { OfflineState } from '../../components/OfflineState';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useGiveaways, useHomeData, useSearchGiveaways } from '../../hooks/useGiveaways';
import { Giveaway } from '../../types/models';
import { classifyQueryError, useRefetchOnFocus } from '../../utils/query';
import { openGiveawaySelection } from '../../utils/giveawayAction';
import { MainTabParamList, RootStackParamList } from '../types';
import { getEstimatedItemLayout, LIST_BATCHING } from '../../utils/list';
import { BRAND } from '../../theme';

type HomeRouteProp = RouteProp<MainTabParamList, 'Home'>;
type DetailNavigation = NativeStackNavigationProp<RootStackParamList>;
type TabNavigation = BottomTabNavigationProp<MainTabParamList, 'Home'>;

const ESTIMATED_CARD_HEIGHT = 250;

function formatStatsLabel(activeCount?: number, totalCount?: number): string | undefined {
  if (typeof activeCount === 'number' && typeof totalCount === 'number') {
    return `${activeCount} aktiv · ${totalCount} gesamt`;
  }

  if (typeof activeCount === 'number') {
    return `${activeCount} aktive Gewinnspiele`;
  }

  if (typeof totalCount === 'number') {
    return `${totalCount} Gewinnspiele insgesamt`;
  }

  return undefined;
}

export function HomeScreen() {
  const route = useRoute<HomeRouteProp>();
  const navigation = useNavigation<DetailNavigation>();
  const tabNavigation = useNavigation<TabNavigation>();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);

  const categoryId = route.params?.categoryId;
  const categoryTitle = route.params?.categoryTitle;
  const categorySlug = route.params?.categorySlug;
  const hasCategoryFilter = Boolean(categoryId || categorySlug);
  const hasSearch = debouncedQuery.trim().length >= 2;

  const homeQuery = useHomeData();
  const listQuery = useGiveaways({ categoryId, categorySlug }, { enabled: hasCategoryFilter && !hasSearch });
  const searchQuery = useSearchGiveaways({ query: debouncedQuery, categoryId, categorySlug }, { enabled: hasSearch });
  const activeQuery = hasSearch ? searchQuery : hasCategoryFilter ? listQuery : homeQuery;
  useRefetchOnFocus(activeQuery.refetch);

  const data = useMemo(() => {
    if (hasSearch) return searchQuery.data ?? [];
    if (hasCategoryFilter) return listQuery.data ?? [];
    return [...(homeQuery.data?.top3 ?? []), ...(homeQuery.data?.newest ?? [])];
  }, [hasSearch, hasCategoryFilter, searchQuery.data, listQuery.data, homeQuery.data]);
  const errorInfo = classifyQueryError(activeQuery.error);

  const handleRefresh = useCallback(() => {
    void activeQuery.refetch();
  }, [activeQuery]);

  const clearFilter = useCallback(() => {
    tabNavigation.setParams({ categoryId: undefined, categorySlug: undefined, categoryTitle: undefined });
  }, [tabNavigation]);

  const handlePressItem = useCallback(
    (selected: Giveaway) => {
      void openGiveawaySelection(selected, (idOrSlug) => navigation.navigate('GiveawayDetail', { idOrSlug }));
    },
    [navigation]
  );

  const renderItem = useCallback(({ item }: { item: Giveaway }) => <GiveawayCard item={item} onPress={handlePressItem} />, [handlePressItem]);
  const keyExtractor = useCallback((item: Giveaway, index: number) => `${item.id}:${item.slug}:${index}`, []);

  const homeStatsLabel = formatStatsLabel(homeQuery.data?.stats.activeCount, homeQuery.data?.stats.totalCount);

  const emptyComponent = useMemo(
    () => <EmptyState title="Keine Treffer" message="Passe die Suche oder Filter an." onRetry={handleRefresh} />,
    [handleRefresh]
  );

  if (activeQuery.isPending && !Array.isArray(data) && !homeQuery.data) {
    return <LoadingState label="Gewinnspiele werden geladen…" />;
  }

  if (activeQuery.isPending && !data.length && !homeQuery.data && !listQuery.data && !searchQuery.data) {
    return <LoadingState label="Gewinnspiele werden geladen…" />;
  }

  if (activeQuery.isError && !data.length) {
    if (errorInfo.kind === 'offline') return <OfflineState message={errorInfo.message} onRetry={handleRefresh} />;
    return <ErrorState title={errorInfo.title} message={errorInfo.message} onRetry={handleRefresh} />;
  }

  return (
    <View style={styles.container}>
      <BrandHeader
        title="Deine Gewinnspiel-Übersicht"
        subtitle={hasCategoryFilter ? 'Gefilterte Liste aus /api/list.php.' : hasSearch ? 'Suchtreffer aus echten Listendaten.' : 'Startdaten aus /api/home.php.'}
      />
      {!hasCategoryFilter && !hasSearch && homeStatsLabel ? (
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>{homeStatsLabel}</Text>
          <Text style={styles.statsSubtext}>Top 3 und neueste Gewinnspiele werden direkt von den produktiven PHP-Endpunkten geladen.</Text>
        </View>
      ) : null}
      {categoryTitle ? (
        <View style={styles.filterInfoContainer}>
          <Text style={styles.filterInfo}>Filter aktiv: {categoryTitle}</Text>
          <Pressable onPress={clearFilter} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.filterAction}>Filter entfernen</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.searchRow}>
        <TextInput placeholder="Suche Gewinnspiele" value={query} onChangeText={setQuery} style={styles.search} autoCapitalize="none" returnKeyType="search" />
      </View>
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        renderItem={renderItem}
        getItemLayout={getEstimatedItemLayout(ESTIMATED_CARD_HEIGHT)}
        {...LIST_BATCHING}
        refreshControl={<RefreshControl refreshing={activeQuery.isRefetching && !activeQuery.isPending} onRefresh={handleRefresh} tintColor="#fff" />}
        ListEmptyComponent={emptyComponent}
        ListFooterComponent={activeQuery.isFetching && !activeQuery.isRefetching ? <ActivityIndicator style={styles.listLoader} color="#fff" /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.colors.bg, padding: 12 },
  statsContainer: { marginBottom: 10, backgroundColor: '#0f355a', padding: 12, borderRadius: 12, gap: 4 },
  statsText: { fontWeight: '800', color: '#fff' },
  statsSubtext: { color: '#9adfff' },
  filterInfoContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, backgroundColor: '#0f355a', padding: 10, borderRadius: 12 },
  filterInfo: { fontWeight: '700', color: '#9adfff' },
  filterAction: { color: '#fff', textDecorationLine: 'underline' },
  searchRow: { marginBottom: 12 },
  search: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: BRAND.colors.border, paddingHorizontal: 12, paddingVertical: 10 },
  listLoader: { marginVertical: 12 }
});
