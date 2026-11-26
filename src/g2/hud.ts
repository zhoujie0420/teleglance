import {
  CreateStartUpPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  MenuContainerProperty,
  MenuItemProperty,
  TextContainerProperty,
} from "@evenrealities/even_hub_sdk";
import type { InboxSnapshot, TelegramMessage } from "../types.js";

export const G2_WIDTH = 576;
export const G2_HEIGHT = 288;

export type HudView = "INBOX" | "MESSAGE" | "CONFIRM" | "DIGEST";

export const MENU_IDS = {
  DIGEST: 1,
  UNREAD_ONLY: 2,
  REFRESH: 3,
  BACK_INBOX: 4,
} as const;

export interface HudState {
  view: HudView;
  unreadOnly: boolean;
  inbox: InboxSnapshot;
  selectedMessage?: TelegramMessage;
  selectedDraft?: string;
  toast?: string;
}

function baseMenu(): MenuContainerProperty {
  return new MenuContainerProperty({
    menuItems: [
      new MenuItemProperty({ itemID: MENU_IDS.DIGEST, itemName: "Channel Digest" }),
      new MenuItemProperty({ itemID: MENU_IDS.UNREAD_ONLY, itemName: "Toggle Unread" }),
      new MenuItemProperty({ itemID: MENU_IDS.REFRESH, itemName: "Sync Telegram" }),
      new MenuItemProperty({ itemID: MENU_IDS.BACK_INBOX, itemName: "VIP Inbox" }),
    ],
  });
}

export function visibleMessages(state: HudState): TelegramMessage[] {
  return state.unreadOnly
    ? state.inbox.messages.filter((m) => m.unread)
    : state.inbox.messages;
}

function clip(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max - 1) + "…";
}

export function buildG2Page(state: HudState): CreateStartUpPageContainer {
  const modeTag = state.inbox.mode === "live-telegram" ? "LIVE BOT" : "SANDBOX";
  const header = `TELEGLANCE · ${modeTag} · UNREAD:${state.inbox.unreadCount}`;

  if (state.view === "MESSAGE" && state.selectedMessage) {
    const m = state.selectedMessage;
    const actions = [
      ...m.drafts.slice(0, 3).map((d, i) => `[${i + 1}] ${clip(d, 44)}`),
      "✓ Mark Read (No Reply)",
      "← Back to Inbox",
    ];
    return new CreateStartUpPageContainer({
      containerTotalNum: 3,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: "msg-header",
          xPosition: 16,
          yPosition: 8,
          width: 544,
          height: 28,
          zOrderIndex: 1,
          content: `${m.chatTitle} · ${m.sender}`,
          textColor: 4,
          isEventCapture: 0,
        }),
        new TextContainerProperty({
          containerID: 2,
          containerName: "msg-body",
          xPosition: 16,
          yPosition: 40,
          width: 544,
          height: 46,
          zOrderIndex: 2,
          content: clip(m.text, 92),
          textColor: 3,
          isEventCapture: 0,
        }),
      ],
      listObject: [
        new ListContainerProperty({
          containerID: 3,
          containerName: "msg-drafts",
          xPosition: 16,
          yPosition: 92,
          width: 544,
          height: 184,
          zOrderIndex: 3,
          isEventCapture: 1,
          itemContainer: new ListItemContainerProperty({
            itemCount: actions.length,
            itemWidth: 530,
            itemName: actions,
          }),
        }),
      ],
      menuObject: baseMenu(),
    });
  }

  if (state.view === "CONFIRM" && state.selectedMessage && state.selectedDraft) {
    return new CreateStartUpPageContainer({
      containerTotalNum: 3,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: "confirm-title",
          xPosition: 16,
          yPosition: 10,
          width: 544,
          height: 30,
          zOrderIndex: 1,
          content: `SEND TELEGRAM REPLY -> ${clip(state.selectedMessage.chatTitle, 26)}`,
          textColor: 4,
          isEventCapture: 0,
        }),
        new TextContainerProperty({
          containerID: 2,
          containerName: "confirm-draft",
          xPosition: 16,
          yPosition: 48,
          width: 544,
          height: 58,
          zOrderIndex: 2,
          content: `"${clip(state.selectedDraft, 88)}"`,
          textColor: 4,
          isEventCapture: 0,
        }),
      ],
      listObject: [
        new ListContainerProperty({
          containerID: 3,
          containerName: "confirm-list",
          xPosition: 16,
          yPosition: 120,
          width: 544,
          height: 152,
          zOrderIndex: 3,
          isEventCapture: 1,
          itemContainer: new ListItemContainerProperty({
            itemCount: 2,
            itemWidth: 530,
            itemName: ["✓ SEND VIA TELEGRAM NOW", "✕ CANCEL"],
          }),
        }),
      ],
      menuObject: baseMenu(),
    });
  }

  if (state.view === "DIGEST") {
    const items = [
      ...state.inbox.digest.slice(0, 5).map((d) => `${d.channel}: ${clip(d.summary, 42)}`),
      "← Back to VIP Inbox",
    ];
    return new CreateStartUpPageContainer({
      containerTotalNum: 2,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: "digest-header",
          xPosition: 16,
          yPosition: 10,
          width: 544,
          height: 30,
          zOrderIndex: 1,
          content: "TELEGRAM CHANNEL DIGEST (30-SEC BRIEF)",
          textColor: 4,
          isEventCapture: 0,
        }),
      ],
      listObject: [
        new ListContainerProperty({
          containerID: 2,
          containerName: "digest-list",
          xPosition: 16,
          yPosition: 48,
          width: 544,
          height: 224,
          zOrderIndex: 2,
          isEventCapture: 1,
          itemContainer: new ListItemContainerProperty({
            itemCount: items.length,
            itemWidth: 530,
            itemName: items,
          }),
        }),
      ],
      menuObject: baseMenu(),
    });
  }

  const msgs = visibleMessages(state).slice(0, 7);
  const rows =
    msgs.length > 0
      ? msgs.map((m) => `${m.unread ? "● " : "  "}${clip(m.chatTitle, 16)}: ${clip(m.text, 34)}`)
      : ["Inbox Zero! All Telegram chats cleared."];

  return new CreateStartUpPageContainer({
    containerTotalNum: 3,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: "inbox-header",
        xPosition: 16,
        yPosition: 8,
        width: 544,
        height: 28,
        zOrderIndex: 1,
        content: state.toast ?? header,
        textColor: 4,
        isEventCapture: 0,
      }),
      new TextContainerProperty({
        containerID: 2,
        containerName: "inbox-hint",
        xPosition: 16,
        yPosition: 256,
        width: 544,
        height: 24,
        zOrderIndex: 2,
        content: "RING: Scroll · TAP: AI Reply · LONG-PRESS: Digest",
        textColor: 2,
        isEventCapture: 0,
      }),
    ],
    listObject: [
      new ListContainerProperty({
        containerID: 3,
        containerName: "inbox-list",
        xPosition: 16,
        yPosition: 42,
        width: 544,
        height: 208,
        zOrderIndex: 3,
        isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({
          itemCount: rows.length,
          itemWidth: 530,
          itemName: rows,
        }),
      }),
    ],
    menuObject: baseMenu(),
  });
}

export function validateG2PageLayout(page: CreateStartUpPageContainer): string[] {
  const errors: string[] = [];
  const texts = page.textObject ?? [];
  const lists = page.listObject ?? [];
  const images = page.imageObject ?? [];
  const all = [...texts, ...lists, ...images];
  if (page.containerTotalNum !== all.length) errors.push("containerTotalNum mismatch");
  if (all.length < 1 || all.length > 12) errors.push("container count out of 1..12");
  let captures = 0;
  const z = new Set<number>();
  for (const c of all) {
    if ((c.xPosition ?? 0) + (c.width ?? 0) > G2_WIDTH || (c.yPosition ?? 0) + (c.height ?? 0) > G2_HEIGHT) {
      errors.push(`${c.containerName} out of 576x288`);
    }
    if ("isEventCapture" in c && c.isEventCapture === 1) captures++;
    if (c.zOrderIndex === undefined || z.has(c.zOrderIndex)) errors.push(`invalid zOrderIndex on ${c.containerName}`);
    else z.add(c.zOrderIndex);
  }
  if (captures !== 1) errors.push(`expected 1 isEventCapture, got ${captures}`);
  return errors;
}
