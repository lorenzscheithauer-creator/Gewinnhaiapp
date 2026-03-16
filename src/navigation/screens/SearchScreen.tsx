import { useMemo, useState } from 'react';
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
import { RootStackParamList } from '../types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function SearchScreen() {
  const navigation = useNavigation<Navigation>();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);
  const shouldSearch = debouncedQuery.trim().length >= 2;
  const giveawaysQuery = useGiveaways({ query: debouncedQuery }, { enabled: shouldSearch });
  useRefetchOnFocus(giveawaysQuery.refetch, { minIntervalMs: 10_000 });
  const offline = isOfflineError(giveawaysQuery.error);

  const data = useMemo(() => {
    if (!shouldSearch) return [];
    return giveawaysQuery.data ?? [];
  }, [giveawaysQuery.data, shouldSearch]);

  if (giveawaysQuery.isPending && !Array.isArray(giveawaysQuery.data) && query.trim().length >= 2) {
    return <LoadingState label="Suche wird geladen…" />;
  }

  if (giveawaysQuery.isError && !Array.isArray(giveawaysQuery.data) && query.trim().length >= 2) {
    if (offline) return <OfflineState message={(giveawaysQuery.error as Error).message} onRetry={() => giveawaysQuery.refetch()} />;
    return <ErrorState message={(giveawaysQuery.error as Error).message} onRetry={() => giveawaysQuery.refetch()} />;
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
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable style={styles.clearButton} onPress={() => setQuery('')}>
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
        keyExtractor={(item, index) => `${item.id}:${item.slug}:${index}`}
        refreshControl={<RefreshControl refreshing={giveawaysQuery.isRefetching && !giveawaysQuery.isPending} onRefresh={() => giveawaysQuery.refetch()} />}
        ListEmptyComponent={
          query.trim().length < 2 ? (
            <EmptyState title="Suche starten" message="Gib mindestens 2 Zeichen ein, um Live-Gewinnspiele zu suchen." />
          ) : (
            <EmptyState title="Keine Treffer" message="Keine passenden Gewinnspiele gefunden." onRetry={() => giveawaysQuery.refetch()} />
          )
        }
        ListFooterComponent={giveawaysQuery.isFetching && !giveawaysQuery.isRefetching ? <ActivityIndicator style={styles.listLoader} /> : null}
        renderItem={({ item }: { item: Giveaway }) => (
          <GiveawayCard item={item} onPress={(selected) => navigation.navigate('GiveawayDetail', { idOrSlug: selected.slug || selected.id })} />
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
