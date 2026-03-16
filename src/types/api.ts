export type ApiEnvelope<T> = {
  data?: T;
  result?: T;
  results?: T;
  items?: T;
  payload?: T;
  response?: T;
  message?: string;
  error?: string;
};

export type ApiListContainer = {
  giveaways?: unknown[];
  categories?: unknown[];
  top10?: unknown[];
  items?: unknown[];
  entries?: unknown[];
  data?: unknown[];
};

export type ApiGiveawayListResponse = ApiEnvelope<unknown[] | ApiListContainer>;

export type ApiCategoryListResponse = ApiEnvelope<unknown[] | ApiListContainer>;

export type ApiTopListResponse = ApiEnvelope<unknown[] | ApiListContainer>;

export type ApiGiveawayDetailResponse = ApiEnvelope<unknown>;
