import { Linking } from 'react-native';

import { normalizeUrl } from '../api/mappers';

function withFallbackProtocol(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, '')}`;
}

export async function openExternalUrl(rawUrl: string): Promise<{ ok: boolean; reason?: string }> {
  const normalized = normalizeUrl(rawUrl);
  const url = normalized ? encodeURI(normalized) : undefined;

  if (!url) {
    return { ok: false, reason: 'Ungültiger Link.' };
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return { ok: true };
    }

    const fallbackUrl = withFallbackProtocol(url);
    const canOpenFallback = await Linking.canOpenURL(fallbackUrl);
    if (!canOpenFallback) {
      return { ok: false, reason: 'Dieser Gewinnspiel-Link kann auf dem Gerät nicht geöffnet werden.' };
    }

    await Linking.openURL(fallbackUrl);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Der externe Link konnte nicht geöffnet werden.' };
  }
}
