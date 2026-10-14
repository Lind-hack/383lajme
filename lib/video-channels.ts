// Official YouTube channels whose newest uploads fill the "Video" rows.
//
// The same channels the news pipeline trusts for story clips
// (scripts/news_video_policy.py CHANNELS — keep the two in step): the
// subject's own channel — governments, institutions, leagues, clubs,
// companies — never a news outlet. Each is filed under the 383 section its
// videos belong in, so a section page shows its own.

import type { NavCategory } from "./category-map";

export type VideoChannel = { id: string; name: string; category: NavCategory };

export const VIDEO_CHANNELS: VideoChannel[] = [
  { id: "UCYxRlFDqcWM4y7FfpiAN3KQ", name: "The White House", category: "Botë" },
  { id: "UCHlEaKbepQ_S9iIoZPKVQew", name: "NATO", category: "Botë" },
  { id: "UCMPaviJxybo1RTdzvYcU91A", name: "European Commission", category: "Botë" },
  { id: "UCvU4p_w08osQsrNi_I4ZtDA", name: "European Parliament", category: "Botë" },
  { id: "UC5O114-PQNYkurlTg6hekZw", name: "United Nations", category: "Botë" },
  { id: "UClqnG2M4VkvtervvU8LnErQ", name: "Zelenskyy Official", category: "Botë" },
  { id: "UC8o7mIMg3mmO9-dx3e2iFgw", name: "10 Downing Street", category: "Botë" },
  { id: "UCcnFmkINMo4Jmkx5mvlCh6g", name: "Bundesregierung", category: "Botë" },
  { id: "UC4wJmdmJW6dN0OLmJL0I-mw", name: "Albin Kurti", category: "Kosovë" },
  { id: "UC_l2qmM0mXkq5pOBEp3j2dw", name: "Edi Rama", category: "Shqipëri" },
  { id: "UCB_qr75-ydFVKSF9Dmo6izg", name: "Formula 1", category: "Sport" },
  { id: "UCyGa1YEx9ST66rYrJTGIKOw", name: "UEFA", category: "Sport" },
  { id: "UCpcTrCXblq78GZrTUTLWeBw", name: "FIFA", category: "Sport" },
  { id: "UCG5qGWdu8nIRZqJ_GgDwQ-w", name: "Premier League", category: "Sport" },
  { id: "UCTv-XvfzLX3i4IGWAm4sbmA", name: "LALIGA", category: "Sport" },
  { id: "UCBJeMCIeLQos7wacox4hmLQ", name: "Serie A", category: "Sport" },
  { id: "UC6UL29enLNe4mqwTfAyeNuw", name: "Bundesliga", category: "Sport" },
  { id: "UCWJ2lWNubArHWmf3FIHbfcQ", name: "NBA", category: "Sport" },
  { id: "UCDVYQ4Zhbm3S2dlz7P1GBDg", name: "NFL", category: "Sport" },
  { id: "UCY_5h5zaSwN7Or4kIJDYNXA", name: "ATP Tour", category: "Sport" },
  { id: "UCaBIVVpHjq6j3tSyxwTE-8Q", name: "WTA", category: "Sport" },
  { id: "UCWV3obpZVGgJ3j9FVhEjF2Q", name: "Real Madrid", category: "Sport" },
  { id: "UC14UlmYlSNiQCBe9Eookf_A", name: "FC Barcelona", category: "Sport" },
  { id: "UCkzCjdRMrW2vXLx8mvPVLdQ", name: "Man City", category: "Sport" },
  { id: "UC9LQwHZoucFT94I2h6JOcjw", name: "Liverpool FC", category: "Sport" },
  { id: "UCpryVRk_VDudG8SHXgWcG0w", name: "Arsenal", category: "Sport" },
  { id: "UC6yW44UGJJBvYTlfC7CRg2Q", name: "Manchester United", category: "Sport" },
  { id: "UCU2PacFf99vhb3hNiYDmxww", name: "Chelsea FC", category: "Sport" },
  { id: "UCZkcxFIsqW5htimoUQKA0iA", name: "FC Bayern München", category: "Sport" },
  { id: "UCLzKhsxrExAC6yAdtZ-BOWw", name: "Juventus", category: "Sport" },
  { id: "UCvXzEblUa0cfny4HAJ_ZOWw", name: "Inter", category: "Sport" },
  { id: "UCKcx1uK38H4AOkmfv4ywlrg", name: "AC Milan", category: "Sport" },
  { id: "UCt9a_qP9CqHCNwilf-iULag", name: "Paris Saint-Germain", category: "Sport" },
  { id: "UCE_M8A5yxnLfW0KghEeajjw", name: "Apple", category: "Teknologji" },
  { id: "UCK8sQmJBp8GCxrOtXWBpyEA", name: "Google", category: "Teknologji" },
  { id: "UCFtEEv80fQVKkD4h1PF-Xqw", name: "Microsoft", category: "Teknologji" },
  { id: "UCWwgaK7x0_FR1goeSRazfsQ", name: "Samsung", category: "Teknologji" },
  { id: "UCXZCJLdBC09xxGZ6gcdrc6A", name: "OpenAI", category: "Teknologji" },
  { id: "UC5WjFrtBdufl6CZojX3D8dQ", name: "Tesla", category: "Teknologji" },
  { id: "UCLA_DiR1FfKNvjuUpBHmylQ", name: "NASA", category: "Teknologji" },
  { id: "UCtI0Hodo5o5dUb67FeUjDeA", name: "SpaceX", category: "Teknologji" },
  { id: "UC04FyDIvYXNecpbG8gyOw4A", name: "Meta", category: "Teknologji" },
  { id: "UCIYhr3JsLYfKkCM7-W5B6DA", name: "IMF", category: "Ekonomi" },
  { id: "UCAzhpt9DmG6PnHXjmJTvRGQ", name: "Federal Reserve", category: "Ekonomi" },
];
