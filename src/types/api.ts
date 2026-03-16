export type ApiEnvelope<T> = {
  data?: T;
  result?: T;
  items?: T;
};

export type ApiGiveawayListResponse = ApiEnvelope<unknown[] | { giveaways?: unknown[]; items?: unknown[] }>;

export type ApiCategoryListResponse = ApiEnvelope<unknown[] | { categories?: unknown[]; items?: unknown[] }>;

export type ApiTopListResponse = ApiEnvelope<unknown[] | { top10?: unknown[]; items?: unknown[] }>;

export type ApiGiveawayDetailResponse = ApiEnvelope<unknown>;
