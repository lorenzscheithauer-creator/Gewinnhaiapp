import AsyncStorage from '@react-native-async-storage/async-storage';

export async function setCache<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify({ ts: Date.now(), value }));
}

export async function getCache<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { value: T };
    return parsed.value;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}
