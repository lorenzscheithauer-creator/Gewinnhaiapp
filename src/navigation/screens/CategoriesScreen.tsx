import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useCallback } from 'react';

import { BrandHeader } from '../../components/BrandHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { OfflineState } from '../../components/OfflineState';
import { useCategories } from '../../hooks/useGiveaways';
import { Category } from '../../types/models';
import { classifyQueryError, useRefetchOnFocus } from '../../utils/query';
import { MainTabParamList } from '../types';
import { getEstimatedItemLayout, LIST_BATCHING } from '../../utils/list';
import { BRAND } from '../../theme';

type NavigationProp = BottomTabNavigationProp<MainTabParamList, 'Categories'>;
const ESTIMATED_ITEM_HEIGHT = 104;

export function CategoriesScreen() {
  const categoriesQuery = useCategories();
  const navigation = useNavigation<NavigationProp>();

  useRefetchOnFocus(categoriesQuery.refetch);
  const errorInfo = classifyQueryError(categoriesQuery.error);

  const handleRefresh = useCallback(() => {
    void categoriesQuery.refetch();
  }, [categoriesQuery]);

  const keyExtractor = useCallback((item: Category) => `${item.id}:${item.slug}`, []);

  const renderItem = useCallback(
    ({ item }: { item: Category }) => (
      <Pressable onPress={() => navigation.navigate('Home', { categoryId: item.id, categorySlug: item.slug, categoryTitle: item.title })} style={styles.item}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>Tippe, um gefilterte Gewinnspiele anzuzeigen.</Text>
      </Pressable>
    ),
    [navigation]
  );

  if (categoriesQuery.isPending && !Array.isArray(categoriesQuery.data)) return <LoadingState label="Kategorien werden geladen…" />;
  if (categoriesQuery.isError && !Array.isArray(categoriesQuery.data)) {
    if (errorInfo.kind === 'offline') return <OfflineState message={errorInfo.message} onRetry={handleRefresh} />;
    return <ErrorState title={errorInfo.title} message={errorInfo.message} onRetry={handleRefresh} />;
  }

  return (
    <View style={styles.container}>
      <BrandHeader title="Kategorien" subtitle="Finde Gewinnspiele nach Themen." />
      <FlatList
        data={categoriesQuery.data ?? []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getEstimatedItemLayout(ESTIMATED_ITEM_HEIGHT)}
        {...LIST_BATCHING}
        refreshControl={<RefreshControl refreshing={categoriesQuery.isRefetching && !categoriesQuery.isPending} onRefresh={handleRefresh} tintColor="#fff" />}
        ListEmptyComponent={<EmptyState title="Keine Kategorien" message="Sobald das Backend Kategorien liefert, erscheinen sie hier." onRetry={handleRefresh} />}
      />
      {categoriesQuery.isFetching && !categoriesQuery.isRefetching ? <ActivityIndicator style={styles.fetchingIndicator} color="#fff" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.colors.bg, padding: 12 },
  item: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderColor: '#d8e4ee', borderWidth: 1, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: '700', color: '#102a44' },
  subtitle: { marginTop: 4, color: '#5f6f82' },
  fetchingIndicator: { position: 'absolute', top: 8, right: 12 }
});
