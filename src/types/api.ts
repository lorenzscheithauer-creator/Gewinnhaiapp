import { Category, Giveaway, TopItem } from './models';

export type ApiEnvelope<T> = {
  ok?: boolean;
  data: T;
  meta?: Record<string, unknown>;
  message?: string;
  error?: string;
};

export type ApiGiveawayListResponse = ApiEnvelope<Giveaway[]>;
export type ApiCategoryListResponse = ApiEnvelope<Category[]>;
export type ApiTopListResponse = ApiEnvelope<TopItem[]>;
export type ApiGiveawayDetailResponse = ApiEnvelope<Giveaway>;
export type ApiSearchResponse = ApiEnvelope<Giveaway[]>;
