import http from "node:http";
import { TeleGlanceStore } from "./telegram.js";

const PORT = Number(process.env.PORT ?? 8788);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const store = new TeleGlanceStore(true);

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.from(c));
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end();
    return;
  }
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, service: "teleglance-backend", liveBot: Boolean(BOT_TOKEN) });
    }
    if (req.method === "GET" && url.pathname === "/api/inbox") {
      await store.pollTelegramBot(BOT_TOKEN);
      return sendJson(res, 200, store.snapshot(Boolean(BOT_TOKEN)));
    }
    if (req.method === "POST" && url.pathname === "/api/reply") {
      const body = await readJsonBody(req);
      const sent = await store.sendReply(String(body.messageId ?? ""), String(body.text ?? ""), BOT_TOKEN);
      return sendJson(res, 201, { sent, inbox: store.snapshot(Boolean(BOT_TOKEN)) });
    }
    if (req.method === "POST" && url.pathname === "/api/read") {
      const body = await readJsonBody(req);
      const updated = store.markRead(String(body.messageId ?? ""));
      return sendJson(res, 200, { message: updated, inbox: store.snapshot(Boolean(BOT_TOKEN)) });
    }
    return sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    return sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[TeleGlance] Backend listening on http://127.0.0.1:${PORT}`);
});
