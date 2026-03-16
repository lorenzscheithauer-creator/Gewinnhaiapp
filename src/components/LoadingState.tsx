import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function LoadingState() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#0a7ea4" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
