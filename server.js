// Ranked WordBomb - serveur sans dépendance (Node 18+)
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const PORT = process.env.PORT || 3000;
const DB = path.join(process.env.DATA_DIR || __dirname, "data.json");
let D = { accounts: {}, tokens: {}, players: {} };
try { D = Object.assign(D, JSON.parse(fs.readFileSync(DB, "utf8"))); } catch (e) {}
let dirty = false;
const save = () => { dirty = true; };
setInterval(() => { if (dirty) { dirty = false; try { fs.writeFileSync(DB, JSON.stringify(D)); } catch (e) {} } }, 3000);

const rooms = new Map(); // name -> Map(cid -> {pres, res})
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const body = req => new Promise(ok => { let b = ""; req.on("data", c => { b += c; if (b.length > 8192) req.destroy(); }); req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch (e) { ok({}); } }); });
const authId = (req, url) => { const h = req.headers.authorization; const t = h ? h.replace(/^Bearer /, "") : url.searchParams.get("t"); return D.tokens[t] || null; };
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString("hex");
const pub = a => ({ id: a.id, n: a.n, email: a.email, stats: D.players[a.id] ? { e: D.players[a.id].e, w: D.players[a.id].w, l: D.players[a.id].l, p: D.players[a.id].p } : null });
const newToken = id => { const t = crypto.randomBytes(24).toString("hex"); D.tokens[t] = id; save(); return t; };
const num = (v, max) => Math.max(0, Math.min(max, Math.floor(+v || 0)));

function broadcast(name) {
  const r = rooms.get(name); if (!r) return;
  const snap = JSON.stringify([...r].map(([cid, c]) => ({ peer: cid, presence: c.pres })));
  for (const c of r.values()) c.res && c.res.write("data: " + snap + "\n\n");
}
function drop(name, cid) {
  const r = rooms.get(name); if (!r) return;
  r.delete(cid); if (!r.size) rooms.delete(name); else broadcast(name);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "POST" && url.pathname === "/api/register") {
      const b = await body(req), n = String(b.n || "").trim(), email = String(b.email || "").trim().toLowerCase(), pw = String(b.pw || "");
      if (!/^[\w.-]{3,16}$/.test(n)) return json(res, 400, { error: "Username: 3–16 letters, numbers, _ . -" });
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return json(res, 400, { error: "Enter a valid email address" });
      if (pw.length < 6) return json(res, 400, { error: "Password: 6 characters minimum" });
      const all = Object.values(D.accounts);
      if (all.some(a => a.email === email)) return json(res, 400, { error: "This email already has an account" });
      if (all.some(a => a.n.toLowerCase() === n.toLowerCase())) return json(res, 400, { error: "Username already taken" });
      const id = crypto.randomBytes(8).toString("hex"), salt = crypto.randomBytes(16).toString("hex");
      D.accounts[id] = { id, n, email, salt, h: hash(pw, salt) };
      return json(res, 200, { token: newToken(id), acct: pub(D.accounts[id]) });
    }
    if (req.method === "POST" && url.pathname === "/api/login") {
      const b = await body(req), email = String(b.email || "").trim().toLowerCase();
      const a = Object.values(D.accounts).find(x => x.email === email);
      if (!a || !crypto.timingSafeEqual(Buffer.from(hash(String(b.pw || ""), a.salt)), Buffer.from(a.h))) return json(res, 400, { error: "Wrong email or password" });
      return json(res, 200, { token: newToken(a.id), acct: pub(a) });
    }
    if (url.pathname === "/api/me") { const id = authId(req, url); return id ? json(res, 200, pub(D.accounts[id])) : json(res, 401, {}); }
    if (url.pathname === "/api/players" && req.method === "GET") return json(res, 200, Object.entries(D.players).map(([id, p]) => ({ id, n: p.n, e: p.e, w: p.w, l: p.l, p: p.p })));
    if (req.method === "POST" && url.pathname === "/api/player") {
      const id = authId(req, url); if (!id) return json(res, 401, {});
      const b = await body(req); D.players[id] = { n: D.accounts[id].n, e: num(b.e, 5000), w: num(b.w, 1e6), l: num(b.l, 1e6), p: num(b.p, 1e6) }; save();
      return json(res, 200, { ok: 1 });
    }
    if (url.pathname === "/api/events") {
      const id = authId(req, url), room = url.searchParams.get("room") || "", cid = url.searchParams.get("cid") || "";
      if (!id) { res.writeHead(401); return res.end(); }
      if (!/^[\w-]{1,40}$/.test(room) || !/^\w{1,20}$/.test(cid)) { res.writeHead(400); return res.end(); }
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
      if (!rooms.has(room)) rooms.set(room, new Map());
      const r = rooms.get(room), old = r.get(cid);
      r.set(cid, { pres: old ? old.pres : {}, res });
      broadcast(room);
      const hb = setInterval(() => res.write(": hb\n\n"), 20000);
      req.on("close", () => { clearInterval(hb); const c = rooms.get(room) && rooms.get(room).get(cid); if (c && c.res === res) drop(room, cid); });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/presence") {
      if (!authId(req, url)) return json(res, 401, {});
      const b = await body(req), r = rooms.get(b.room), c = r && r.get(b.cid);
      if (c && b.data && typeof b.data === "object" && JSON.stringify(b.data).length < 4000) { Object.assign(c.pres, b.data); broadcast(b.room); }
      return json(res, 200, { ok: 1 });
    }
    if (req.method === "POST" && url.pathname === "/api/leave") { const b = await body(req); if (b.room && b.cid) drop(b.room, b.cid); return json(res, 200, { ok: 1 }); }
    if (url.pathname === "/" || url.pathname === "/index.html") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return res.end(fs.readFileSync(path.join(__dirname, "public", "index.html"))); }
    res.writeHead(404); res.end("Not found");
  } catch (e) { try { json(res, 500, { error: "Server error" }); } catch (x) {} }
}).listen(PORT, () => console.log("Ranked WordBomb sur http://localhost:" + PORT));
