import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { BrandHeader } from '../../components/BrandHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { GiveawayCard } from '../../components/GiveawayCard';
import { LoadingState } from '../../components/LoadingState';
import { OfflineState } from '../../components/OfflineState';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSearchGiveaways } from '../../hooks/useGiveaways';
import { Giveaway } from '../../types/models';
import { classifyQueryError, useRefetchOnFocus } from '../../utils/query';
import { openGiveawaySelection } from '../../utils/giveawayAction';
import { RootStackParamList } from '../types';
import { getEstimatedItemLayout, LIST_BATCHING } from '../../utils/list';
import { BRAND } from '../../theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
const ESTIMATED_CARD_HEIGHT = 250;

export function SearchScreen() {
  const navigation = useNavigation<Navigation>();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);
  const shouldSearch = debouncedQuery.trim().length >= 2;
  const giveawaysQuery = useSearchGiveaways({ query: debouncedQuery }, { enabled: shouldSearch });
  useRefetchOnFocus(giveawaysQuery.refetch, { enabled: shouldSearch, minIntervalMs: 10_000 });
  const errorInfo = classifyQueryError(giveawaysQuery.error);

  const data = useMemo(() => (shouldSearch ? giveawaysQuery.data ?? [] : []), [giveawaysQuery.data, shouldSearch]);

  const handleRefresh = useCallback(() => {
    void giveawaysQuery.refetch();
  }, [giveawaysQuery]);

  const handlePressItem = useCallback(
    (selected: Giveaway) => {
      void openGiveawaySelection(selected, (idOrSlug) => navigation.navigate('GiveawayDetail', { idOrSlug }));
    },
    [navigation]
  );

  const renderItem = useCallback(({ item }: { item: Giveaway }) => <GiveawayCard item={item} onPress={handlePressItem} />, [handlePressItem]);
  const keyExtractor = useCallback((item: Giveaway) => `${item.id}:${item.slug}`, []);

  if (giveawaysQuery.isPending && !Array.isArray(giveawaysQuery.data) && shouldSearch) return <LoadingState label="Suche wird geladen…" />;
  if (giveawaysQuery.isError && !Array.isArray(giveawaysQuery.data) && shouldSearch) {
    if (errorInfo.kind === 'offline') return <OfflineState message={errorInfo.message} onRetry={handleRefresh} />;
    return <ErrorState title={errorInfo.title} message={errorInfo.message} onRetry={handleRefresh} />;
  }

  return (
    <View style={styles.container}>
      <BrandHeader title="Suche" subtitle="Finde Gewinnspiele in Sekunden." />
      <View style={styles.searchRow}>
        <TextInput placeholder="Mindestens 2 Zeichen eingeben" value={query} onChangeText={setQuery} style={styles.search} autoCapitalize="none" autoCorrect={false} />
        {query.length > 0 ? (
          <Pressable style={styles.clearButton} onPress={() => setQuery('')}>
            <Text style={styles.clearLabel}>Reset</Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        renderItem={renderItem}
        getItemLayout={getEstimatedItemLayout(ESTIMATED_CARD_HEIGHT)}
        {...LIST_BATCHING}
        refreshControl={<RefreshControl enabled={shouldSearch} refreshing={giveawaysQuery.isRefetching && !giveawaysQuery.isPending} onRefresh={handleRefresh} tintColor="#fff" />}
        ListEmptyComponent={query.trim().length < 2 ? <EmptyState title="Suche starten" message="Gib mindestens 2 Zeichen ein." /> : <EmptyState title="Keine Treffer" message="Keine passenden Gewinnspiele gefunden." onRetry={handleRefresh} />}
        ListFooterComponent={giveawaysQuery.isFetching && !giveawaysQuery.isRefetching ? <ActivityIndicator style={styles.listLoader} color="#fff" /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.colors.bg, padding: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  search: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#d8e4ee', paddingHorizontal: 12, paddingVertical: 10 },
  clearButton: { backgroundColor: '#0f355a', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  clearLabel: { color: '#9adfff', fontWeight: '700' },
  listLoader: { marginVertical: 12 }
});
