import { Linking } from 'react-native';

import { normalizeUrl } from '../api/mappers';

export async function openExternalUrl(rawUrl: string): Promise<{ ok: boolean; reason?: string }> {
  const url = normalizeUrl(rawUrl);

  if (!url) {
    return { ok: false, reason: 'Ungültiger Link.' };
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      return { ok: false, reason: 'Dieser Gewinnspiel-Link kann auf dem Gerät nicht geöffnet werden.' };
    }

    await Linking.openURL(url);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Der externe Link konnte nicht geöffnet werden.' };
  }
}
