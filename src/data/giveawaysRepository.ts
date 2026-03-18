import { fetchCategories, fetchGiveawayDetail, fetchGiveaways, fetchSearchGiveaways, fetchTop10 } from '../api/giveaways';
import { Category, Giveaway, SearchParams, TopItem } from '../types/models';
import { log } from '../utils/logger';

export const giveawaysRepository = {
  async list(params?: SearchParams): Promise<Giveaway[]> {
    const data = await fetchGiveaways(params);
    log('debug', 'Giveaways loaded from App API.', { count: data.length, params });
    return data;
  },
  async search(params: SearchParams): Promise<Giveaway[]> {
    const data = await fetchSearchGiveaways(params);
    log('debug', 'Search results loaded from App API.', { count: data.length, params });
    return data;
  },
  async detail(idOrSlug: string): Promise<Giveaway> {
    const detail = await fetchGiveawayDetail(idOrSlug);
    log('debug', 'Giveaway detail loaded from App API.', { idOrSlug, resolvedId: detail.id });
    return detail;
  },
  async categories(): Promise<Category[]> {
    const categories = await fetchCategories();
    log('debug', 'Categories loaded from App API.', { count: categories.length });
    return categories;
  },
  async top10(): Promise<TopItem[]> {
    const list = await fetchTop10();
    log('debug', 'Top10 loaded from App API.', { count: list.length });
    return list;
  }
};
