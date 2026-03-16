import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { ErrorState } from '../../components/ErrorState';
import { GiveawayCard } from '../../components/GiveawayCard';
import { LoadingState } from '../../components/LoadingState';
import { useGiveaways } from '../../hooks/useGiveaways';

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const giveawaysQuery = useGiveaways({ query });

  const data = useMemo(() => giveawaysQuery.data ?? [], [giveawaysQuery.data]);

  if (giveawaysQuery.isLoading) return <LoadingState />;

  if (giveawaysQuery.isError) {
    return <ErrorState message={(giveawaysQuery.error as Error).message} onRetry={() => giveawaysQuery.refetch()} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Aktuelle Gewinnspiele</Text>
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
        renderItem={({ item }) => (
          <GiveawayCard item={item} onPress={(selected) => navigation.navigate('GiveawayDetail', { idOrSlug: selected.slug ?? selected.id })} />
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
