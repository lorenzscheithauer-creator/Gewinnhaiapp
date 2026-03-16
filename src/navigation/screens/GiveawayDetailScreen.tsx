import { Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { useGiveawayDetail } from '../../hooks/useGiveawayDetail';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'GiveawayDetail'>;

export function GiveawayDetailScreen({ route }: Props) {
  const detailQuery = useGiveawayDetail(route.params.idOrSlug);

  if (detailQuery.isLoading) return <LoadingState />;

  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState message={(detailQuery.error as Error)?.message} onRetry={() => detailQuery.refetch()} />;
  }

  const item = detailQuery.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.teaser}>{item.teaser}</Text>
      {item.description ? <Text style={styles.body}>{item.description}</Text> : null}
      <Pressable style={styles.button} onPress={() => Linking.openURL(item.sourceUrl)}>
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
  title: {
    fontSize: 24,
    fontWeight: '800'
  },
  teaser: {
    fontSize: 16,
    color: '#555'
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
