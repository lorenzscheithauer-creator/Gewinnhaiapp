export type RootStackParamList = {
  MainTabs: undefined;
  GiveawayDetail: { idOrSlug: string };
};

export type MainTabParamList = {
  Home: { categoryId?: string; categorySlug?: string; categoryTitle?: string } | undefined;
  Categories: undefined;
  Top10: undefined;
  Search: undefined;
};
