import "./styles.css";
import type { CreateStartUpPageContainer } from "@evenrealities/even_hub_sdk";
import { connectG2Bridge, type G2BridgeHandle } from "./g2/bridge.js";
import { buildG2Page, MENU_IDS, visibleMessages, type HudState } from "./g2/hud.js";
import type { InboxSnapshot } from "./types.js";

const state: HudState = {
  view: "INBOX",
  unreadOnly: false,
  inbox: { mode: "sandbox-demo", unreadCount: 0, messages: [], sentReplies: [], digest: [] },
};

let selectedIdx = 0;
let bridge: G2BridgeHandle;

function renderPreview(page: CreateStartUpPageContainer) {
  const screen = document.getElementById("g2-screen");
  if (!screen) return;
  screen.innerHTML = "";
  for (const t of page.textObject ?? []) {
    const el = document.createElement("div");
    el.className = `g2-text g2-c${t.textColor ?? 4}`;
    el.style.left = `${t.xPosition ?? 0}px`;
    el.style.top = `${t.yPosition ?? 0}px`;
    el.style.width = `${t.width ?? 544}px`;
    el.style.height = `${t.height ?? 28}px`;
    el.textContent = t.content ?? "";
    screen.appendChild(el);
  }
  for (const l of page.listObject ?? []) {
    const wrap = document.createElement("div");
    wrap.className = "g2-list";
    wrap.style.left = `${l.xPosition ?? 0}px`;
    wrap.style.top = `${l.yPosition ?? 0}px`;
    wrap.style.width = `${l.width ?? 544}px`;
    wrap.style.height = `${l.height ?? 200}px`;
    const names = l.itemContainer?.itemName ?? [];
    if (selectedIdx >= names.length) selectedIdx = Math.max(0, names.length - 1);
    names.forEach((name, idx) => {
      const row = document.createElement("div");
      row.className = `g2-list-item${idx === selectedIdx ? " selected" : ""}`;
      row.textContent = `${idx === selectedIdx ? "▸ " : "  "}${name}`;
      row.addEventListener("click", () => {
        selectedIdx = idx;
        void handleSelect(idx);
      });
      wrap.appendChild(row);
    });
    screen.appendChild(wrap);
  }
}

function renderPanel() {
  const sum = document.getElementById("summary-grid");
  const sent = document.getElementById("sent-list");
  const dig = document.getElementById("digest-list");
  if (!sum || !sent || !dig) return;
  sum.innerHTML = `
    <div class="stat-card"><div class="stat-label">Unread VIPs</div><div class="stat-val">${state.inbox.unreadCount}</div></div>
    <div class="stat-card"><div class="stat-label">Replies Sent</div><div class="stat-val">${state.inbox.sentReplies.length}</div></div>
    <div class="stat-card"><div class="stat-label">Bot Mode</div><div class="stat-val">${state.inbox.mode === "live-telegram" ? "LIVE" : "DEMO"}</div></div>
  `;
  sent.innerHTML = state.inbox.sentReplies.length
    ? state.inbox.sentReplies.map((r) => `<div class="log-row"><strong>${r.id}</strong> -> ${r.chatTitle}: "${r.text}" <em>(${r.delivery})</em></div>`).join("")
    : `<div class="empty-note">Tap any Telegram message on the G2 HUD to approve an AI reply in 1 tap.</div>`;
  dig.innerHTML = state.inbox.digest
    .map((d) => `<div class="log-row"><strong>${d.channel}</strong> — ${d.summary}</div>`)
    .join("");
}

async function syncHud() {
  const page = buildG2Page(state);
  renderPreview(page);
  renderPanel();
  await bridge.pushPage(page);
}

function setToast(msg: string) {
  state.toast = msg;
  setTimeout(() => {
    if (state.toast === msg) {
      state.toast = undefined;
      void syncHud();
    }
  }, 3200);
}

async function refreshInbox() {
  const res = await fetch("/api/inbox");
  if (!res.ok) return;
  state.inbox = (await res.json()) as InboxSnapshot;
  await syncHud();
}

async function handleSelect(idx: number) {
  if (state.view === "INBOX") {
    const msgs = visibleMessages(state).slice(0, 7);
    const chosen = msgs[idx];
    if (!chosen) return;
    state.selectedMessage = chosen;
    state.view = "MESSAGE";
    selectedIdx = 0;
    await syncHud();
    return;
  }
  if (state.view === "MESSAGE" && state.selectedMessage) {
    const drafts = state.selectedMessage.drafts.slice(0, 3);
    if (idx < drafts.length) {
      state.selectedDraft = drafts[idx];
      state.view = "CONFIRM";
      selectedIdx = 0;
      await syncHud();
    } else if (idx === drafts.length) {
      const res = await fetch("/api/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId: state.selectedMessage.id }),
      });
      const data = (await res.json()) as { inbox?: InboxSnapshot };
      if (data.inbox) state.inbox = data.inbox;
      setToast("✓ Marked Read");
      state.view = "INBOX";
      state.selectedMessage = undefined;
      selectedIdx = 0;
      await syncHud();
    } else {
      state.view = "INBOX";
      state.selectedMessage = undefined;
      selectedIdx = 0;
      await syncHud();
    }
    return;
  }
  if (state.view === "CONFIRM" && state.selectedMessage && state.selectedDraft) {
    if (idx === 0) {
      const res = await fetch("/api/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId: state.selectedMessage.id, text: state.selectedDraft }),
      });
      const data = (await res.json()) as { sent?: { id: string }; inbox?: InboxSnapshot };
      if (data.inbox) state.inbox = data.inbox;
      setToast(data.sent ? `✓ SENT ${data.sent.id} VIA TELEGRAM` : "Send failed");
    }
    state.selectedDraft = undefined;
    state.selectedMessage = undefined;
    state.view = "INBOX";
    selectedIdx = 0;
    await syncHud();
    return;
  }
  if (state.view === "DIGEST") {
    state.view = "INBOX";
    selectedIdx = 0;
    await syncHud();
  }
}

async function handleMenu(itemID: number) {
  if (itemID === MENU_IDS.DIGEST) {
    state.view = "DIGEST";
    selectedIdx = 0;
    await syncHud();
  } else if (itemID === MENU_IDS.UNREAD_ONLY) {
    state.unreadOnly = !state.unreadOnly;
    state.view = "INBOX";
    selectedIdx = 0;
    setToast(state.unreadOnly ? "FILTER: UNREAD ONLY" : "FILTER: ALL VIP CHATS");
    await syncHud();
  } else if (itemID === MENU_IDS.REFRESH) {
    setToast("Syncing Telegram…");
    await refreshInbox();
  } else if (itemID === MENU_IDS.BACK_INBOX) {
    state.view = "INBOX";
    selectedIdx = 0;
    await syncHud();
  }
}

function moveSel(delta: number) {
  const page = buildG2Page(state);
  const len = page.listObject?.[0]?.itemContainer?.itemName?.length ?? 0;
  if (len <= 0) return;
  selectedIdx = (selectedIdx + delta + len) % len;
  renderPreview(page);
}

async function boot() {
  bridge = await connectG2Bridge();
  const pill = document.getElementById("mode-pill");
  if (pill) pill.textContent = bridge.mode === "even-g2" ? "Connected · Even G2" : "Preview · Even G2 576×288";
  bridge.onEvent((ev) => {
    if (ev.listEvent?.currentSelectItemIndex !== undefined) void handleSelect(ev.listEvent.currentSelectItemIndex);
    if (ev.menuItemClickEvent?.itemID !== undefined) void handleMenu(ev.menuItemClickEvent.itemID);
  });
  document.getElementById("btn-up")?.addEventListener("click", () => moveSel(-1));
  document.getElementById("btn-down")?.addEventListener("click", () => moveSel(1));
  document.getElementById("btn-tap")?.addEventListener("click", () => void handleSelect(selectedIdx));
  document.getElementById("btn-digest")?.addEventListener("click", () => void handleMenu(MENU_IDS.DIGEST));
  document.getElementById("btn-unread")?.addEventListener("click", () => void handleMenu(MENU_IDS.UNREAD_ONLY));
  document.getElementById("btn-sync")?.addEventListener("click", () => void handleMenu(MENU_IDS.REFRESH));
  await refreshInbox();
}
void boot();
