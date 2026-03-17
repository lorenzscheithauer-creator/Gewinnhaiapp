import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BRAND } from '../theme';

interface OfflineStateProps {
  message?: string;
  onRetry?: () => void;
}

export function OfflineState({ message, onRetry }: OfflineStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🦈 Du bist gerade offline</Text>
      <Text style={styles.message}>{message ?? 'Bitte prüfe deine Verbindung. Wir zeigen verfügbare Cache-Daten, sobald vorhanden.'}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.button} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.buttonLabel}>Erneut versuchen</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.colors.bg },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  message: { textAlign: 'center', color: '#cce7ff' },
  button: { backgroundColor: BRAND.colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  buttonLabel: { color: '#052338', fontWeight: '700' }
});
