import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
import { RootStackParamList } from '../types';
import { getEstimatedItemLayout, LIST_BATCHING } from '../../utils/list';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const ESTIMATED_CARD_HEIGHT = 250;

export function SearchScreen() {
  const navigation = useNavigation<Navigation>();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);
  const shouldSearch = debouncedQuery.trim().length >= 2;
  const giveawaysQuery = useGiveaways({ query: debouncedQuery }, { enabled: shouldSearch });
  useRefetchOnFocus(giveawaysQuery.refetch, { enabled: shouldSearch, minIntervalMs: 10_000 });
  const offline = isOfflineError(giveawaysQuery.error);

  const data = useMemo(() => {
    if (!shouldSearch) return [];
    return giveawaysQuery.data ?? [];
  }, [giveawaysQuery.data, shouldSearch]);

  const handleRefresh = useCallback(() => {
    void giveawaysQuery.refetch();
  }, [giveawaysQuery]);

  const handlePressItem = useCallback(
    (selected: Giveaway) => {
      void openGiveawaySelection(selected, (idOrSlug) => navigation.navigate('GiveawayDetail', { idOrSlug }));
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: Giveaway }) => <GiveawayCard item={item} onPress={handlePressItem} />,
    [handlePressItem]
  );

  const keyExtractor = useCallback((item: Giveaway) => `${item.id}:${item.slug}`, []);

  if (giveawaysQuery.isPending && !Array.isArray(giveawaysQuery.data) && query.trim().length >= 2) {
    return <LoadingState label="Suche wird geladen…" />;
  }

  if (giveawaysQuery.isError && !Array.isArray(giveawaysQuery.data) && query.trim().length >= 2) {
    if (offline) return <OfflineState message={(giveawaysQuery.error as Error).message} onRetry={handleRefresh} />;
    return <ErrorState message={(giveawaysQuery.error as Error).message} onRetry={handleRefresh} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Suche</Text>
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Mindestens 2 Zeichen eingeben"
          value={query}
          onChangeText={setQuery}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable style={styles.clearButton} onPress={() => setQuery('')} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.clearLabel}>Reset</Text>
          </Pressable>
        ) : null}
      </View>

      {query.trim().length === 1 ? <Text style={styles.inlineHint}>Bitte mindestens 2 Zeichen für die Live-Suche eingeben.</Text> : null}
      {giveawaysQuery.isError && (giveawaysQuery.data?.length ?? 0) > 0 ? (
        <Text style={styles.inlineWarning}>Suche zeigt gecachte Daten. Für aktuelle Treffer bitte erneut aktualisieren.</Text>
      ) : null}

      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        renderItem={renderItem}
        getItemLayout={getEstimatedItemLayout(ESTIMATED_CARD_HEIGHT)}
        {...LIST_BATCHING}
        refreshControl={<RefreshControl enabled={shouldSearch} refreshing={giveawaysQuery.isRefetching && !giveawaysQuery.isPending} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          query.trim().length < 2 ? (
            <EmptyState title="Suche starten" message="Gib mindestens 2 Zeichen ein, um Live-Gewinnspiele zu suchen." />
          ) : (
            <EmptyState title="Keine Treffer" message="Keine passenden Gewinnspiele gefunden." onRetry={handleRefresh} />
          )
        }
        ListFooterComponent={giveawaysQuery.isFetching && !giveawaysQuery.isRefetching ? <ActivityIndicator style={styles.listLoader} /> : null}
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
