export interface Category {
  id: string;
  slug: string;
  title: string;
  iconUrl?: string;
}

export interface Giveaway {
  id: string;
  slug: string;
  title: string;
  teaser: string;
  description?: string;
  imageUrl?: string;
  categoryId?: string;
  expiresAt?: string;
  sourceUrl?: string;
  featured?: boolean;
}

export interface TopItem {
  id: string;
  rank: number;
  title: string;
  teaser?: string;
  giveawayId?: string;
  giveawaySlug?: string;
  sourceUrl?: string;
}

export interface SearchParams {
  query?: string;
  categoryId?: string;
}
