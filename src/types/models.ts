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
  categorySlug?: string;
  categoryLabel?: string;
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

export interface HomeStats {
  activeCount?: number;
  endedCount?: number;
  totalCount?: number;
  [key: string]: string | number | undefined;
}

export interface HomeData {
  stats: HomeStats;
  top3: Giveaway[];
  newest: Giveaway[];
}

export interface SearchParams {
  query?: string;
  categoryId?: string;
  categorySlug?: string;
  page?: number;
  perPage?: number;
}
