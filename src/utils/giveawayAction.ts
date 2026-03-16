import { Alert } from 'react-native';

import { openExternalUrl } from './links';
import { resolveGiveawayNavigationId } from './giveaway';
import { Giveaway, TopItem } from '../types/models';

type GiveawaySelection =
  | Pick<Giveaway, 'id' | 'slug' | 'sourceUrl'>
  | Pick<TopItem, 'giveawayId' | 'giveawaySlug' | 'sourceUrl'>;

export async function openGiveawaySelection(
  item: GiveawaySelection,
  navigateToDetail: (idOrSlug: string) => void,
  options?: { missingDetailTitle?: string; missingDetailMessage?: string }
): Promise<void> {
  const idOrSlug = resolveGiveawayNavigationId(item);

  if (idOrSlug) {
    navigateToDetail(idOrSlug);
    return;
  }

  if (item.sourceUrl) {
    const result = await openExternalUrl(item.sourceUrl);
    if (!result.ok) {
      Alert.alert('Link nicht verfügbar', result.reason ?? 'Der Gewinnspiel-Link kann nicht geöffnet werden.');
    }
    return;
  }

  Alert.alert(options?.missingDetailTitle ?? 'Keine Details verfügbar', options?.missingDetailMessage ?? 'Für dieses Gewinnspiel fehlen aktuell nutzbare Detaildaten.');
}
