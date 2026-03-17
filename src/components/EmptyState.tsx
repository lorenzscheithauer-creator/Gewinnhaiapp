import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BRAND } from '../theme';

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
  container: { padding: 24, gap: 10, alignItems: 'center', backgroundColor: '#0f355a', borderRadius: 16, borderWidth: 1, borderColor: '#1e4f7a' },
  title: { fontSize: 18, fontWeight: '700', color: '#fff' },
  message: { textAlign: 'center', color: '#cce7ff' },
  button: { marginTop: 6, backgroundColor: BRAND.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  buttonLabel: { color: '#052338', fontWeight: '700' }
});
