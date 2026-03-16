import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Giveaway } from '../types/models';

interface GiveawayCardProps {
  item: Giveaway;
  onPress: (item: Giveaway) => void;
}

export function GiveawayCard({ item, onPress }: GiveawayCardProps) {
  return (
    <Pressable style={styles.card} onPress={() => onPress(item)}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} /> : null}
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.teaser} numberOfLines={3}>
          {item.teaser}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e6e6e6'
  },
  image: {
    width: '100%',
    height: 160
  },
  content: {
    padding: 12,
    gap: 6
  },
  title: {
    fontSize: 16,
    fontWeight: '700'
  },
  teaser: {
    color: '#555',
    lineHeight: 20
  }
});
