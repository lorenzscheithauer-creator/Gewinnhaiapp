import { StyleSheet, Text, View } from 'react-native';

interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
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
  }
});
