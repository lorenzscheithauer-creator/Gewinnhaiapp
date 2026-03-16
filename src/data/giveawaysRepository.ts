import { fetchCategories, fetchGiveawayDetail, fetchGiveaways, fetchTop10 } from '../api/giveaways';
import { Category, Giveaway, SearchParams, TopItem } from '../types/models';
import { log } from '../utils/logger';

export const giveawaysRepository = {
  async list(params?: SearchParams): Promise<Giveaway[]> {
    const data = await fetchGiveaways(params);
    log('debug', 'Giveaways loaded.', { count: data.length, params });
    return data;
  },
  async detail(idOrSlug: string): Promise<Giveaway> {
    const detail = await fetchGiveawayDetail(idOrSlug);
    log('debug', 'Giveaway detail loaded.', { idOrSlug, resolvedId: detail.id });
    return detail;
  },
  async categories(): Promise<Category[]> {
    const categories = await fetchCategories();
    log('debug', 'Categories loaded.', { count: categories.length });
    return categories;
  },
  async top10(): Promise<TopItem[]> {
    const list = await fetchTop10();
    log('debug', 'Top10 loaded.', { count: list.length });
    return list;
  }
};
