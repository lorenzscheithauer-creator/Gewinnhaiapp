import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { OfflineState } from '../../components/OfflineState';
import { useGiveawayDetail } from '../../hooks/useGiveawayDetail';
import { classifyQueryError, useRefetchOnFocus } from '../../utils/query';
import { openExternalUrl } from '../../utils/links';
import { RootStackParamList } from '../types';
import { BRAND } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'GiveawayDetail'>;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatExpiresAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('de-DE');
}

export function GiveawayDetailScreen({ route }: Props) {
  const normalizedIdOrSlug = safeDecode(route.params.idOrSlug).trim();
  const detailQuery = useGiveawayDetail(normalizedIdOrSlug);
  useRefetchOnFocus(detailQuery.refetch, { minIntervalMs: 15_000 });
  const errorInfo = classifyQueryError(detailQuery.error);

  const openSource = async (url: string) => {
    const result = await openExternalUrl(url);
    if (!result.ok) Alert.alert('Link nicht verfügbar', result.reason ?? 'Der Link kann auf diesem Gerät nicht geöffnet werden.');
  };

  if (detailQuery.isPending && !detailQuery.data) return <LoadingState label="Gewinnspiel wird geladen…" />;
  if (detailQuery.isError && !detailQuery.data) {
    if (errorInfo.kind === 'offline') return <OfflineState message={errorInfo.message} onRetry={() => detailQuery.refetch()} />;
    return <ErrorState title={errorInfo.title} message={errorInfo.message} onRetry={() => detailQuery.refetch()} />;
  }

  const item = detailQuery.data;
  const canonicalGewinnhaiUrl = item?.slug ? `https://www.gewinnhai.de/gewinnspiel/${encodeURIComponent(item.slug)}` : undefined;
  const actionUrl = item?.sourceUrl ?? canonicalGewinnhaiUrl;

  if (!item) return <EmptyState title="Keine Details verfügbar" message="Für dieses Gewinnspiel sind aktuell keine Live-Details verfügbar." />;

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={detailQuery.isRefetching && !detailQuery.isPending} onRefresh={() => detailQuery.refetch()} tintColor="#fff" />}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" /> : null}
      <View style={styles.panel}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.teaser}>{item.teaser}</Text>
        {item.expiresAt ? (
          <View style={styles.metaTag}>
            <Text style={styles.metaText}>Läuft bis: {formatExpiresAt(item.expiresAt)}</Text>
          </View>
        ) : null}
        {item.description ? <Text style={styles.body}>{item.description}</Text> : <EmptyState title="Keine Beschreibung" message="Für dieses Gewinnspiel wurde keine Detailbeschreibung geliefert." onRetry={() => detailQuery.refetch()} />}
        {actionUrl ? (
          <Pressable style={styles.button} onPress={() => actionUrl && openSource(actionUrl)}>
            <Text style={styles.buttonLabel}>Zum Gewinnspiel</Text>
          </Pressable>
        ) : (
          <EmptyState title="Kein Link verfügbar" message="Der externe Link wurde von der Live-API nicht geliefert." onRetry={() => detailQuery.refetch()} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: BRAND.colors.bg, gap: 12 },
  image: { width: '100%', height: 210, borderRadius: 16 },
  panel: { backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#0c1d34' },
  teaser: { fontSize: 16, color: '#556a7d' },
  metaTag: { alignSelf: 'flex-start', backgroundColor: '#e7f6fc', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  metaText: { color: '#006f90', fontWeight: '700' },
  body: { lineHeight: 22, color: '#203348' },
  button: { backgroundColor: BRAND.colors.primary, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  buttonLabel: { color: '#052338', fontWeight: '700' }
});
