import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BRAND } from '../theme';

interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = 'Lade Inhalte…' }: LoadingStateProps) {
  return (
    <View style={styles.center}>
      <Text style={styles.top}>GewinnHai lädt</Text>
      <ActivityIndicator size="large" color={BRAND.colors.primary} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, backgroundColor: BRAND.colors.bg },
  top: { color: '#9adfff', fontWeight: '700' },
  label: { color: '#cce7ff' }
});
