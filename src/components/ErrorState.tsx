import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verbindung fehlgeschlagen</Text>
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
