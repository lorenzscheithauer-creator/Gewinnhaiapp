import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { useCategories } from '../../hooks/useGiveaways';
import { Category } from '../../types/models';
import { MainTabParamList } from '../types';

type NavigationProp = BottomTabNavigationProp<MainTabParamList, 'Categories'>;

export function CategoriesScreen() {
  const categoriesQuery = useCategories();
  const navigation = useNavigation<NavigationProp>();

  if (categoriesQuery.isLoading && !Array.isArray(categoriesQuery.data)) {
    return <LoadingState label="Kategorien werden geladen…" />;
  }

  if (categoriesQuery.isError && !Array.isArray(categoriesQuery.data)) {
    return <ErrorState message={(categoriesQuery.error as Error).message} onRetry={() => categoriesQuery.refetch()} />;
  }

  return (
    <View style={styles.container}>
      {categoriesQuery.isError ? <Text style={styles.inlineWarning}>Offline/Fallback aktiv: Kategorien können veraltet sein.</Text> : null}
      <FlatList
        data={categoriesQuery.data ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={categoriesQuery.isRefetching} onRefresh={categoriesQuery.refetch} />}
        ListEmptyComponent={<EmptyState title="Keine Kategorien" message="Sobald das Backend Kategorien liefert, erscheinen sie hier." />}
        renderItem={({ item }: { item: Category }) => (
          <Pressable onPress={() => navigation.navigate('Home', { categoryId: item.id, categoryTitle: item.title })} style={styles.item}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>Tippe, um gefilterte Gewinnspiele anzuzeigen.</Text>
          </Pressable>
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
  },
  inlineWarning: {
    marginBottom: 10,
    color: '#9b6a00',
    fontSize: 12
  }
});
