import type { DigestBullet, InboxSnapshot, SentReply, TelegramMessage } from "../src/types.js";

export function draftGlanceReplies(sender: string, text: string): string[] {
  const lower = text.toLowerCase();
  if (lower.includes("meeting") || lower.includes("call") || lower.includes("sync") || lower.includes("demo")) {
    return [
      "On my way — joining in 2 mins.",
      "Can we push 15 mins? Wrapping up now.",
      "Got it, send the deck link please.",
    ];
  }
  if (lower.includes("deploy") || lower.includes("pr") || lower.includes("release") || lower.includes("merge")) {
    return [
      "LGTM — approved to ship to prod.",
      "Hold 10 mins, checking CI logs first.",
      "Merged! Monitoring metrics now.",
    ];
  }
  if (lower.includes("price") || lower.includes("btc") || lower.includes("funding") || lower.includes("market")) {
    return [
      "Saw it — keeping risk tight here.",
      "Thanks for the heads up, checking now.",
      "Let's review levels after the close.",
    ];
  }
  return [
    `Got it ${sender.split(" ")[0]}, will handle shortly.`,
    "Sounds good — confirmed!",
    "In transit, will reply in detail soon.",
  ];
}

export class TeleGlanceStore {
  private messages: TelegramMessage[] = [];
  private sentReplies: SentReply[] = [];
  private digest: DigestBullet[] = [];
  private lastUpdateId = 0;
  private seq = 1;

  constructor(seedDemo = true) {
    if (seedDemo) {
      const now = new Date();
      const ago = (mins: number) => new Date(now.getTime() - mins * 60_000).toISOString();
      this.messages = [
        {
          id: "tg-101",
          chatId: "work-core-eng",
          chatTitle: "Core Eng · Release",
          chatKind: "group",
          sender: "Alex Chen",
          text: "Release v2.4 PR passed all 48 integration tests. Ready to deploy?",
          receivedAt: ago(2),
          unread: true,
          priority: "HIGH",
          drafts: draftGlanceReplies("Alex Chen", "Release v2.4 PR passed all 48 integration tests. Ready to deploy?"),
        },
        {
          id: "tg-102",
          chatId: "dubai-demo-day",
          chatTitle: "Daos Hub · Demo Day",
          chatKind: "group",
          sender: "Elena",
          text: "Quick check — are you ready for the 3-min remote demo call at 14:00?",
          receivedAt: ago(7),
          unread: true,
          priority: "HIGH",
          drafts: draftGlanceReplies("Elena", "Quick check — are you ready for the 3-min remote demo call at 14:00?"),
        },
        {
          id: "tg-103",
          chatId: "alpha-desk",
          chatTitle: "Crypto Alpha Desk",
          chatKind: "channel",
          sender: "Desk Bot",
          text: "BTC funding flipped positive (+0.012%) as Hyperliquid OI hit $4.2B.",
          receivedAt: ago(14),
          unread: true,
          priority: "NORMAL",
          drafts: draftGlanceReplies("Desk Bot", "BTC funding flipped positive (+0.012%) as Hyperliquid OI hit $4.2B."),
        },
        {
          id: "tg-104",
          chatId: "sarah-dm",
          chatTitle: "Sarah (Product)",
          chatKind: "dm",
          sender: "Sarah",
          text: "Can you confirm the final G2 pitch slides before 6pm?",
          receivedAt: ago(25),
          unread: true,
          priority: "NORMAL",
          drafts: draftGlanceReplies("Sarah", "Can you confirm the final G2 pitch slides before 6pm?"),
        },
      ];
      this.digest = [
        { channel: "@CoreEng", summary: "v2.4 green on CI; awaiting 1-tap release approval", at: ago(2) },
        { channel: "@DaosHub", summary: "Demo Day remote slot confirmed for 14:00 GMT+4", at: ago(7) },
        { channel: "@AlphaDesk", summary: "BTC funding +0.012%, Hyperliquid OI $4.2B", at: ago(14) },
      ];
    }
  }

  public async pollTelegramBot(token?: string): Promise<void> {
    if (!token) return;
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${this.lastUpdateId + 1}&limit=10`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return;
      const body = (await res.json()) as {
        ok?: boolean;
        result?: Array<{
          update_id: number;
          message?: {
            message_id: number;
            text?: string;
            date?: number;
            from?: { first_name?: string; username?: string };
            chat: { id: number; title?: string; type: string; first_name?: string };
          };
        }>;
      };
      if (!body.ok || !Array.isArray(body.result)) return;

      for (const u of body.result) {
        if (u.update_id > this.lastUpdateId) this.lastUpdateId = u.update_id;
        const m = u.message;
        if (!m?.text) continue;
        const sender = m.from?.first_name ?? m.from?.username ?? "Telegram User";
        const chatTitle = m.chat.title ?? m.chat.first_name ?? `Chat ${m.chat.id}`;
        const chatKind = m.chat.type === "private" ? "dm" : m.chat.type === "channel" ? "channel" : "group";
        const msg: TelegramMessage = {
          id: `tg-live-${m.message_id}`,
          chatId: String(m.chat.id),
          chatTitle,
          chatKind,
          sender,
          text: m.text,
          receivedAt: new Date((m.date ?? Date.now() / 1000) * 1000).toISOString(),
          unread: true,
          priority: "HIGH",
          drafts: draftGlanceReplies(sender, m.text),
        };
        if (!this.messages.some((x) => x.id === msg.id)) {
          this.messages.unshift(msg);
          this.digest.unshift({
            channel: chatTitle,
            summary: `${sender}: ${m.text.slice(0, 64)}`,
            at: msg.receivedAt,
          });
        }
      }
    } catch {
      // keep existing messages if network unavailable
    }
  }

  public async sendReply(messageId: string, text: string, token?: string): Promise<SentReply> {
    const clean = text.trim();
    if (!clean) throw new Error("Reply text cannot be empty");
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error(`Message ${messageId} not found`);

    let delivery: "telegram-api" | "simulator-sandbox" = "simulator-sandbox";
    if (token && /^-?\d+$/.test(msg.chatId)) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: msg.chatId, text: clean }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) delivery = "telegram-api";
    }

    msg.unread = false;
    const sent: SentReply = {
      id: `REP-${String(this.seq++).padStart(4, "0")}`,
      messageId: msg.id,
      chatId: msg.chatId,
      chatTitle: msg.chatTitle,
      text: clean,
      sentAt: new Date().toISOString(),
      delivery,
    };
    this.sentReplies.unshift(sent);
    return sent;
  }

  public markRead(messageId: string): TelegramMessage {
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) throw new Error(`Message ${messageId} not found`);
    msg.unread = false;
    return msg;
  }

  public snapshot(hasToken: boolean): InboxSnapshot {
    return {
      mode: hasToken ? "live-telegram" : "sandbox-demo",
      unreadCount: this.messages.filter((m) => m.unread).length,
      messages: this.messages,
      sentReplies: this.sentReplies,
      digest: this.digest.slice(0, 6),
    };
  }
}
