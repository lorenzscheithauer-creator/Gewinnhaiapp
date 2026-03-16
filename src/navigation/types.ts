export type RootStackParamList = {
  MainTabs: undefined;
  GiveawayDetail: { idOrSlug: string };
};

export type MainTabParamList = {
  Home: { categoryId?: string; categoryTitle?: string } | undefined;
  Categories: undefined;
  Top10: undefined;
};
