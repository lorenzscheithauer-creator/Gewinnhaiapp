import { FlatList, StyleSheet, Text, View } from 'react-native';

import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { useCategories } from '../../hooks/useGiveaways';

export function CategoriesScreen() {
  const categoriesQuery = useCategories();

  if (categoriesQuery.isLoading) return <LoadingState />;

  if (categoriesQuery.isError) {
    return <ErrorState message={(categoriesQuery.error as Error).message} onRetry={() => categoriesQuery.refetch()} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={categoriesQuery.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>Kategorien werden automatisch aus dem Backend geladen.</Text>
          </View>
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
  item: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderColor: '#e6e6e6',
    borderWidth: 1,
    marginBottom: 10
  },
  title: {
    fontSize: 16,
    fontWeight: '700'
  },
  subtitle: {
    marginTop: 4,
    color: '#666'
  }
});
