import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { GiveawayCard } from '../../components/GiveawayCard';
import { LoadingState } from '../../components/LoadingState';
import { useGiveaways } from '../../hooks/useGiveaways';
import { Giveaway } from '../../types/models';
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

  const data = useMemo(() => giveawaysQuery.data ?? [], [giveawaysQuery.data]);

  if (giveawaysQuery.isLoading) return <LoadingState label="Gewinnspiele werden geladen…" />;

  if (giveawaysQuery.isError) {
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
      <TextInput
        placeholder="Suche Gewinnspiele"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={giveawaysQuery.isRefetching} onRefresh={giveawaysQuery.refetch} />}
        ListEmptyComponent={<EmptyState title="Keine Treffer" message="Passe die Suche oder Filter an." />}
        renderItem={({ item }: { item: Giveaway }) => (
          <GiveawayCard
            item={item}
            onPress={(selected) => navigation.navigate('GiveawayDetail', { idOrSlug: selected.slug ?? selected.id })}
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
  search: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12
  }
});
