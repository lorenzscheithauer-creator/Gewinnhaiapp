import { Pressable, StyleSheet, Text, View } from 'react-native';

interface EmptyStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

export function EmptyState({ title, message, onRetry }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.button} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.buttonLabel}>Neu laden</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 10,
    alignItems: 'center'
  },
  title: {
    fontSize: 18,
    fontWeight: '700'
  },
  message: {
    textAlign: 'center',
    color: '#555'
  },
  button: {
    marginTop: 6,
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  buttonLabel: {
    color: '#fff',
    fontWeight: '600'
  }
});
