import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEnvelope<T> {
  ts: number;
  value: T;
  expiresAt?: number;
}

export interface CacheOptions {
  ttlMs?: number;
  allowExpired?: boolean;
}

export interface CacheReadResult<T> {
  value: T;
  ts: number;
  isExpired: boolean;
}

export async function setCache<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
  const ts = Date.now();
  const payload: CacheEnvelope<T> = {
    ts,
    value,
    expiresAt: options?.ttlMs ? ts + options.ttlMs : undefined
  };

  await AsyncStorage.setItem(key, JSON.stringify(payload));
}

export async function getCacheEntry<T>(key: string, options?: CacheOptions): Promise<CacheReadResult<T> | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<CacheEnvelope<T>> | T;

    const hasEnvelope = parsed && typeof parsed === 'object' && 'value' in parsed;
    const value = (hasEnvelope ? (parsed as CacheEnvelope<T>).value : (parsed as T)) as T;
    const ts = hasEnvelope ? Number((parsed as CacheEnvelope<T>).ts ?? 0) : 0;
    const expiresAt = hasEnvelope ? (parsed as CacheEnvelope<T>).expiresAt : undefined;

    const isExpired = typeof expiresAt === 'number' ? Date.now() > expiresAt : false;
    if (isExpired && !options?.allowExpired) return null;

    return { value, ts, isExpired };
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function getCache<T>(key: string, options?: CacheOptions): Promise<T | null> {
  const entry = await getCacheEntry<T>(key, options);
  return entry?.value ?? null;
}
