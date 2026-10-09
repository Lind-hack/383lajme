export type TelegramPreview = {
  messageId: number;
  text: string;
  url: string;
  publishedAt: string;
  articleUrl: string | null;
};
export function latestTelegramMessage(html: string, channel?: string): TelegramPreview | null;
