import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { useGiveawayDetail } from '../../hooks/useGiveawayDetail';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'GiveawayDetail'>;

export function GiveawayDetailScreen({ route }: Props) {
  const detailQuery = useGiveawayDetail(route.params.idOrSlug);

  const openSource = async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };

  if (detailQuery.isLoading) return <LoadingState label="Gewinnspiel wird geladen…" />;

  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState message={(detailQuery.error as Error)?.message} onRetry={() => detailQuery.refetch()} />;
  }

  const item = detailQuery.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} /> : null}
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.teaser}>{item.teaser}</Text>
      {item.expiresAt ? (
        <View style={styles.metaTag}>
          <Text style={styles.metaText}>Läuft bis: {item.expiresAt}</Text>
        </View>
      ) : null}
      {item.description ? <Text style={styles.body}>{item.description}</Text> : null}
      <Pressable style={styles.button} onPress={() => openSource(item.sourceUrl)}>
        <Text style={styles.buttonLabel}>Zum Gewinnspiel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    gap: 12
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12
  },
  title: {
    fontSize: 24,
    fontWeight: '800'
  },
  teaser: {
    fontSize: 16,
    color: '#555'
  },
  metaTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#e7f6fc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999
  },
  metaText: {
    color: '#0a7ea4',
    fontWeight: '600'
  },
  body: {
    lineHeight: 22,
    color: '#333'
  },
  button: {
    backgroundColor: '#0a7ea4',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  buttonLabel: {
    color: '#fff',
    fontWeight: '700'
  }
});
