import { Pressable, StyleSheet, Text, View } from 'react-native';

interface OfflineStateProps {
  message?: string;
  onRetry?: () => void;
}

export function OfflineState({ message, onRetry }: OfflineStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Du bist gerade offline</Text>
      <Text style={styles.message}>{message ?? 'Bitte prüfe deine Verbindung. Wir zeigen verfügbare Cache-Daten, sobald vorhanden.'}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.button}>
          <Text style={styles.buttonLabel}>Erneut versuchen</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center'
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
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  buttonLabel: {
    color: '#fff',
    fontWeight: '600'
  }
});
