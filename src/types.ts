export type ChatKind = "dm" | "group" | "channel";

export interface TelegramMessage {
  id: string;
  chatId: string;
  chatTitle: string;
  chatKind: ChatKind;
  sender: string;
  text: string;
  receivedAt: string;
  unread: boolean;
  priority: "HIGH" | "NORMAL";
  drafts: string[];
}

export interface SentReply {
  id: string;
  messageId: string;
  chatId: string;
  chatTitle: string;
  text: string;
  sentAt: string;
  delivery: "telegram-api" | "simulator-sandbox";
}

export interface DigestBullet {
  channel: string;
  summary: string;
  at: string;
}

export interface InboxSnapshot {
  mode: "live-telegram" | "sandbox-demo";
  unreadCount: number;
  messages: TelegramMessage[];
  sentReplies: SentReply[];
  digest: DigestBullet[];
}
