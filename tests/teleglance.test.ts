import { describe, expect, it } from "vitest";
import { draftGlanceReplies, TeleGlanceStore } from "../server/telegram.js";
import { buildG2Page, validateG2PageLayout, type HudState } from "../src/g2/hud.js";

describe("TeleGlance Telegram Store & AI Reply Drafter", () => {
  it("drafts 3 concise context-aware G2 replies", () => {
    const drafts = draftGlanceReplies("Alex", "Release v2.4 PR passed all tests. Ready to deploy?");
    expect(drafts).toHaveLength(3);
    expect(drafts[0]).toContain("approved");
  });

  it("sends 1-tap confirmed reply and updates unread counter", async () => {
    const store = new TeleGlanceStore(true);
    const before = store.snapshot(false);
    expect(before.unreadCount).toBe(4);
    const target = before.messages[0];
    const sent = await store.sendReply(target.id, target.drafts[0]);
    expect(sent.id).toBe("REP-0001");
    expect(sent.delivery).toBe("simulator-sandbox");
    const after = store.snapshot(false);
    expect(after.unreadCount).toBe(3);
    expect(after.sentReplies).toHaveLength(1);
  });

  it("validates INBOX, MESSAGE, CONFIRM, and DIGEST G2 layouts against SDK 0.0.16 rules", () => {
    const inbox = new TeleGlanceStore(true).snapshot(false);
    const msg = inbox.messages[0];
    const states: HudState[] = [
      { view: "INBOX", unreadOnly: false, inbox },
      { view: "MESSAGE", unreadOnly: false, inbox, selectedMessage: msg },
      { view: "CONFIRM", unreadOnly: false, inbox, selectedMessage: msg, selectedDraft: msg.drafts[0] },
      { view: "DIGEST", unreadOnly: false, inbox },
    ];
    for (const s of states) {
      expect(validateG2PageLayout(buildG2Page(s))).toEqual([]);
    }
  });
});
