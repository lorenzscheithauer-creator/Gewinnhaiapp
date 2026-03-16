import { Giveaway, TopItem } from '../types/models';

function isMeaningfulValue(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized && normalized !== 'unknown');
}

export function resolveGiveawayNavigationId(item: Pick<Giveaway, 'id' | 'slug'> | Pick<TopItem, 'giveawayId' | 'giveawaySlug'>): string | undefined {
  const slug = 'slug' in item ? item.slug : item.giveawaySlug;
  const id = 'id' in item ? item.id : item.giveawayId;

  if (isMeaningfulValue(slug)) return slug.trim();
  if (isMeaningfulValue(id)) return id.trim();

  return undefined;
}
