import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { OfflineState } from '../../components/OfflineState';
import { useTop10 } from '../../hooks/useGiveaways';
import { TopItem } from '../../types/models';
import { useRefetchOnFocus, isOfflineError } from '../../utils/query';
import { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function Top10Screen() {
  const top10Query = useTop10();
  const navigation = useNavigation<NavigationProp>();

  useRefetchOnFocus(top10Query.refetch);
  const offline = isOfflineError(top10Query.error);

  if (top10Query.isPending && !Array.isArray(top10Query.data)) {
    return <LoadingState label="Top10 wird geladen…" />;
  }

  if (top10Query.isError && !Array.isArray(top10Query.data)) {
    if (offline) return <OfflineState message={(top10Query.error as Error).message} onRetry={() => top10Query.refetch()} />;
    return <ErrorState message={(top10Query.error as Error).message} onRetry={() => top10Query.refetch()} />;
  }

  return (
    <View style={styles.container}>
      {top10Query.isError && (top10Query.data?.length ?? 0) > 0 ? (
        <Text style={styles.inlineWarning}>Offline-Modus: Ranking stammt aus zuletzt geladenen Live-Daten.</Text>
      ) : null}
      <FlatList
        data={top10Query.data ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={top10Query.isRefetching && !top10Query.isPending} onRefresh={() => top10Query.refetch()} />}
        ListEmptyComponent={<EmptyState title="Noch keine Top10" message="Die Liste wird automatisch befüllt, sobald Daten verfügbar sind." />}
        renderItem={({ item }: { item: TopItem }) => (
          <Pressable
            disabled={!item.giveawayId}
            onPress={() => item.giveawayId && navigation.navigate('GiveawayDetail', { idOrSlug: item.giveawayId })}
            style={styles.item}
          >
            <Text style={styles.rank}>#{item.rank}</Text>
            <View style={styles.textContainer}>
              <Text style={styles.title}>{item.title}</Text>
              {item.teaser ? <Text style={styles.teaser}>{item.teaser}</Text> : null}
              {!item.giveawayId ? <Text style={styles.hint}>Detail-Link wird bereitgestellt, sobald Backend-ID vorhanden ist.</Text> : null}
            </View>
          </Pressable>
        )}
      />
      {top10Query.isFetching && !top10Query.isRefetching ? <ActivityIndicator style={styles.fetchingIndicator} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fb',
    padding: 12
  },
  item: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6e6e6',
    padding: 14,
    marginBottom: 10,
    gap: 12
  },
  rank: {
    fontWeight: '800',
    fontSize: 18,
    color: '#0a7ea4'
  },
  textContainer: {
    flex: 1,
    gap: 4
  },
  title: {
    fontWeight: '700',
    fontSize: 16
  },
  teaser: {
    color: '#666'
  },
  hint: {
    color: '#88949c',
    fontSize: 12
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
