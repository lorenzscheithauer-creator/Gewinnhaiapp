import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BRAND } from '../theme';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.badge}>⚠️ GewinnHai Status</Text>
      <Text style={styles.title}>{title ?? 'Verbindung fehlgeschlagen'}</Text>
      <Text style={styles.message}>{message ?? 'Bitte überprüfe deine Internetverbindung.'}</Text>
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
  badge: { color: '#9adfff', fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  message: { textAlign: 'center', color: '#cce7ff' },
  button: { backgroundColor: BRAND.colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  buttonLabel: { color: '#052338', fontWeight: '700' }
});
