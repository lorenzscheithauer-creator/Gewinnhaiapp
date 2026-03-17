import { memo, useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Giveaway } from '../types/models';

interface GiveawayCardProps {
  item: Giveaway;
  onPress: (item: Giveaway) => void;
}

function GiveawayCardComponent({ item, onPress }: GiveawayCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const handlePress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);

  return (
    <Pressable style={styles.card} onPress={handlePress} accessibilityRole="button" hitSlop={6}>
      {item.imageUrl && !imageFailed ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} onError={() => setImageFailed(true)} />
      ) : (
        <View style={styles.fallbackImage}>
          <Text style={styles.fallbackLabel}>🦈 GewinnHai</Text>
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.teaser} numberOfLines={3}>
          {item.teaser}
        </Text>
      </View>
    </Pressable>
  );
}

export const GiveawayCard = memo(GiveawayCardComponent);

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: '#d8e4ee' },
  image: { width: '100%', height: 170 },
  fallbackImage: { width: '100%', height: 110, backgroundColor: '#0f355a', alignItems: 'center', justifyContent: 'center' },
  fallbackLabel: { color: '#9adfff', fontWeight: '700' },
  content: { padding: 14, gap: 8 },
  title: { fontSize: 17, fontWeight: '800', color: '#0c1d34' },
  teaser: { color: '#54677a', lineHeight: 20 }
});
