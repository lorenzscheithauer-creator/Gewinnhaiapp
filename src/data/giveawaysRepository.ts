import { fetchCategories, fetchGiveawayDetail, fetchGiveaways, fetchHomeData, fetchSearchGiveaways, fetchTop10 } from '../api/giveaways';
import { Category, Giveaway, HomeData, SearchParams, TopItem } from '../types/models';
import { log } from '../utils/logger';

export const giveawaysRepository = {
  async home(): Promise<HomeData> {
    const data = await fetchHomeData();
    log('debug', 'Home data loaded from production PHP API.', { top3: data.top3.length, newest: data.newest.length, stats: data.stats });
    return data;
  },
  async list(params?: SearchParams): Promise<Giveaway[]> {
    const data = await fetchGiveaways(params);
    log('debug', 'Giveaways loaded from production PHP API.', { count: data.length, params });
    return data;
  },
  async search(params: SearchParams): Promise<Giveaway[]> {
    const data = await fetchSearchGiveaways(params);
    log('debug', 'Search results loaded from production PHP API.', { count: data.length, params });
    return data;
  },
  async detail(idOrSlug: string): Promise<Giveaway> {
    const detail = await fetchGiveawayDetail(idOrSlug);
    log('debug', 'Giveaway detail loaded from production PHP API.', { idOrSlug, resolvedId: detail.id });
    return detail;
  },
  async categories(): Promise<Category[]> {
    const categories = await fetchCategories();
    log('debug', 'Categories derived from production PHP list data.', { count: categories.length });
    return categories;
  },
  async top10(): Promise<TopItem[]> {
    const list = await fetchTop10();
    log('debug', 'Top10 loaded from production PHP API.', { count: list.length });
    return list;
  }
};
