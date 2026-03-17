import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BRAND } from '../theme';

const LOGO_URL = 'https://www.gewinnhai.de/wp-content/uploads/2022/06/gewinnhai-logo.png';

interface BrandHeaderProps {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function BrandHeader({ title, subtitle, actionLabel, onActionPress }: BrandHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
        <Text style={styles.badge}>GewinnHai</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {actionLabel && onActionPress ? (
        <Pressable style={styles.action} onPress={onActionPress} accessibilityRole="button">
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BRAND.colors.bgSoft,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff'
  },
  badge: {
    color: '#fff',
    fontWeight: '700'
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800'
  },
  subtitle: {
    color: '#cce7ff',
    marginTop: 4
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: BRAND.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999
  },
  actionText: {
    color: '#04243b',
    fontWeight: '700'
  }
});
