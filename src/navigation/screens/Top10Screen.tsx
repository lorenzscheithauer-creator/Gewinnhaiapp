import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';

import { BrandHeader } from '../../components/BrandHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { OfflineState } from '../../components/OfflineState';
import { useTop10 } from '../../hooks/useGiveaways';
import { TopItem } from '../../types/models';
import { classifyQueryError, useRefetchOnFocus } from '../../utils/query';
import { RootStackParamList } from '../types';
import { openGiveawaySelection } from '../../utils/giveawayAction';
import { getEstimatedItemLayout, LIST_BATCHING } from '../../utils/list';
import { BRAND } from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const ESTIMATED_ITEM_HEIGHT = 140;

export function Top10Screen() {
  const top10Query = useTop10();
  const navigation = useNavigation<NavigationProp>();

  useRefetchOnFocus(top10Query.refetch);
  const errorInfo = classifyQueryError(top10Query.error);

  const handleRefresh = useCallback(() => {
    void top10Query.refetch();
  }, [top10Query]);

  const keyExtractor = useCallback((item: TopItem) => `${item.id}:${item.rank}`, []);

  const renderItem = useCallback(
    ({ item }: { item: TopItem }) => (
      <Pressable
        onPress={() =>
          void openGiveawaySelection(item, (idOrSlug) => navigation.navigate('GiveawayDetail', { idOrSlug }), {
            missingDetailTitle: 'Kein Detail verfügbar',
            missingDetailMessage: 'Für diesen Eintrag ist aktuell weder Detailseite noch Link vorhanden.'
          })
        }
        style={styles.item}
      >
        <Text style={styles.rank}>#{item.rank}</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          {item.teaser ? <Text style={styles.teaser}>{item.teaser}</Text> : null}
        </View>
      </Pressable>
    ),
    [navigation]
  );

  if (top10Query.isPending && !Array.isArray(top10Query.data)) return <LoadingState label="Top10 wird geladen…" />;
  if (top10Query.isError && !Array.isArray(top10Query.data)) {
    if (errorInfo.kind === 'offline') return <OfflineState message={errorInfo.message} onRetry={handleRefresh} />;
    return <ErrorState title={errorInfo.title} message={errorInfo.message} onRetry={handleRefresh} />;
  }

  return (
    <View style={styles.container}>
      <BrandHeader title="Top 10" subtitle="Die beliebtesten Gewinnchancen der Community." />
      <FlatList
        data={top10Query.data ?? []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getEstimatedItemLayout(ESTIMATED_ITEM_HEIGHT)}
        {...LIST_BATCHING}
        refreshControl={<RefreshControl refreshing={top10Query.isRefetching && !top10Query.isPending} onRefresh={handleRefresh} tintColor="#fff" />}
        ListEmptyComponent={<EmptyState title="Noch keine Top10" message="Die Liste wird befüllt, sobald Daten verfügbar sind." onRetry={handleRefresh} />}
      />
      {top10Query.isFetching && !top10Query.isRefetching ? <ActivityIndicator style={styles.fetchingIndicator} color="#fff" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.colors.bg, padding: 12 },
  item: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#d8e4ee', padding: 14, marginBottom: 10, gap: 12 },
  rank: { fontWeight: '800', fontSize: 20, color: '#008fb2' },
  textContainer: { flex: 1, gap: 4 },
  title: { fontWeight: '700', fontSize: 16, color: '#102a44' },
  teaser: { color: '#5f6f82' },
  fetchingIndicator: { position: 'absolute', top: 8, right: 12 }
});
