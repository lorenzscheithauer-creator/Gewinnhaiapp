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
import { useGiveaways, useSearchGiveaways } from '../../hooks/useGiveaways';
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

export function HomeScreen() {
  const route = useRoute<HomeRouteProp>();
  const navigation = useNavigation<DetailNavigation>();
  const tabNavigation = useNavigation<TabNavigation>();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);

  const categoryId = route.params?.categoryId;
  const categoryTitle = route.params?.categoryTitle;
  const categorySlug = route.params?.categorySlug;

  const listQuery = useGiveaways({ categoryId, categorySlug });
  const searchQuery = useSearchGiveaways({ query: debouncedQuery, categoryId, categorySlug }, { enabled: debouncedQuery.trim().length >= 2 });
  const giveawaysQuery = debouncedQuery.trim().length >= 2 ? searchQuery : listQuery;
  useRefetchOnFocus(giveawaysQuery.refetch);

  const data = giveawaysQuery.data ?? [];
  const errorInfo = classifyQueryError(giveawaysQuery.error);

  const handleRefresh = useCallback(() => {
    void giveawaysQuery.refetch();
  }, [giveawaysQuery]);

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
  const keyExtractor = useCallback((item: Giveaway) => `${item.id}:${item.slug}`, []);

  const emptyComponent = useMemo(
    () => <EmptyState title="Keine Treffer" message="Passe die Suche oder Filter an." onRetry={handleRefresh} />,
    [handleRefresh]
  );

  if (giveawaysQuery.isPending && !Array.isArray(giveawaysQuery.data)) {
    return <LoadingState label="Gewinnspiele werden geladen…" />;
  }

  if (giveawaysQuery.isError && !Array.isArray(giveawaysQuery.data)) {
    if (errorInfo.kind === 'offline') return <OfflineState message={errorInfo.message} onRetry={handleRefresh} />;
    return <ErrorState title={errorInfo.title} message={errorInfo.message} onRetry={handleRefresh} />;
  }

  return (
    <View style={styles.container}>
      <BrandHeader title="Deine Gewinnspiel-Übersicht" subtitle="Neue Chancen, täglich aktualisiert." />
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
        refreshControl={<RefreshControl refreshing={giveawaysQuery.isRefetching && !giveawaysQuery.isPending} onRefresh={handleRefresh} tintColor="#fff" />}
        ListEmptyComponent={emptyComponent}
        ListFooterComponent={giveawaysQuery.isFetching && !giveawaysQuery.isRefetching ? <ActivityIndicator style={styles.listLoader} color="#fff" /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.colors.bg, padding: 12 },
  filterInfoContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, backgroundColor: '#0f355a', padding: 10, borderRadius: 12 },
  filterInfo: { fontWeight: '700', color: '#9adfff' },
  filterAction: { color: '#fff', textDecorationLine: 'underline' },
  searchRow: { marginBottom: 12 },
  search: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: BRAND.colors.border, paddingHorizontal: 12, paddingVertical: 10 },
  listLoader: { marginVertical: 12 }
});
