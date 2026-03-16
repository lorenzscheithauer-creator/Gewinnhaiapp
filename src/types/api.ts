import { Category, Giveaway, TopItem } from './models';

export interface ApiGiveawayResponse {
  data: Giveaway[];
}

export interface ApiCategoryResponse {
  data: Category[];
}

export interface ApiTopResponse {
  data: TopItem[];
}

export interface ApiGiveawayDetailResponse {
  data: Giveaway;
}
