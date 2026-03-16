import { Linking } from 'react-native';

import { normalizeUrl } from '../api/mappers';

function withFallbackProtocol(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, '')}`;
}

function normalizeCandidate(url: string): string {
  return url.replace(/\s/g, '').replace(/#.*$/, '');
}

function buildCandidates(url: string): string[] {
  const normalized = normalizeCandidate(url);
  const withoutTracking = normalized.replace(/[?&](utm_[^=]+|fbclid|gclid)=[^&]+/gi, '').replace(/[?&]$/, '');
  const fallback = withFallbackProtocol(withoutTracking);

  return Array.from(new Set([normalized, withoutTracking, fallback]));
}

export async function openExternalUrl(rawUrl: string): Promise<{ ok: boolean; reason?: string }> {
  const normalized = normalizeUrl(rawUrl);
  const url = normalized ? encodeURI(normalized) : undefined;

  if (!url) {
    return { ok: false, reason: 'Ungültiger Link.' };
  }

  try {
    for (const candidate of buildCandidates(url)) {
      const canOpen = await Linking.canOpenURL(candidate);
      if (!canOpen) continue;

      await Linking.openURL(candidate);
      return { ok: true };
    }

    return { ok: false, reason: 'Dieser Gewinnspiel-Link kann auf dem Gerät nicht geöffnet werden.' };
  } catch {
    return { ok: false, reason: 'Der externe Link konnte nicht geöffnet werden.' };
  }
}
