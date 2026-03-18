import { Category, Giveaway, HomeData, TopItem } from './models';

export type ApiRecord = Record<string, unknown>;

export interface ApiListResponse {
  items?: unknown[];
  found?: number | string;
  page?: number | string;
  per_page?: number | string;
  total_pages?: number | string;
  [key: string]: unknown;
}

export interface ApiItemResponse {
  found?: boolean | number | string;
  item?: unknown;
  [key: string]: unknown;
}

export interface ApiHomeResponse {
  stats?: unknown;
  top3?: {
    items?: unknown[];
    [key: string]: unknown;
  };
  newest?: {
    items?: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type ApiGiveawayListResponse = Giveaway[];
export type ApiCategoryListResponse = Category[];
export type ApiTopListResponse = TopItem[];
export type ApiGiveawayDetailResponse = Giveaway;
export type ApiSearchResponse = Giveaway[];
export type ApiHomeDataResponse = HomeData;
