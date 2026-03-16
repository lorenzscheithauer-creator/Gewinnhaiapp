import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { OfflineState } from '../../components/OfflineState';
import { useCategories } from '../../hooks/useGiveaways';
import { Category } from '../../types/models';
import { useRefetchOnFocus, isOfflineError } from '../../utils/query';
import { MainTabParamList } from '../types';

type NavigationProp = BottomTabNavigationProp<MainTabParamList, 'Categories'>;

export function CategoriesScreen() {
  const categoriesQuery = useCategories();
  const navigation = useNavigation<NavigationProp>();

  useRefetchOnFocus(categoriesQuery.refetch);
  const offline = isOfflineError(categoriesQuery.error);

  if (categoriesQuery.isPending && !Array.isArray(categoriesQuery.data)) {
    return <LoadingState label="Kategorien werden geladen…" />;
  }

  if (categoriesQuery.isError && !Array.isArray(categoriesQuery.data)) {
    if (offline) return <OfflineState message={(categoriesQuery.error as Error).message} onRetry={() => categoriesQuery.refetch()} />;
    return <ErrorState message={(categoriesQuery.error as Error).message} onRetry={() => categoriesQuery.refetch()} />;
  }

  return (
    <View style={styles.container}>
      {categoriesQuery.isError && (categoriesQuery.data?.length ?? 0) > 0 ? (
        <Text style={styles.inlineWarning}>Offline-Modus: Kategorien stammen aus zuletzt geladenen Live-Daten.</Text>
      ) : null}
      <FlatList
        data={categoriesQuery.data ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={categoriesQuery.isRefetching && !categoriesQuery.isPending}
            onRefresh={() => categoriesQuery.refetch()}
          />
        }
        ListEmptyComponent={<EmptyState title="Keine Kategorien" message="Sobald das Backend Kategorien liefert, erscheinen sie hier." />}
        renderItem={({ item }: { item: Category }) => (
          <Pressable onPress={() => navigation.navigate('Home', { categoryId: item.id, categoryTitle: item.title })} style={styles.item}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>Tippe, um gefilterte Gewinnspiele anzuzeigen.</Text>
          </Pressable>
        )}
      />
      {categoriesQuery.isFetching && !categoriesQuery.isRefetching ? <ActivityIndicator style={styles.fetchingIndicator} /> : null}
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
  },
  fetchingIndicator: {
    position: 'absolute',
    top: 8,
    right: 12
  }
});
