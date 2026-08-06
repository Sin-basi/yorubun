/* 夜文法 ｜ service worker。
   飛行機モードで一課まるごと読めることが目的。

   app shell は precache して cache first。
   content/index.json は network first（内容が増えたらすぐ気づきたい）。
   content/batchNN.json は cache first で、index.json の contentVersion が
   変わったときだけ捨てて取り直す。

   VERSION は中身を変えたら必ず上げる。上げないと古い shell が残る。 */

const VERSION = "v2";
const SHELL = `yorubun-shell-${VERSION}`;
const CONTENT = `yorubun-content-${VERSION}`;
const META = "yorubun-meta";           // contentVersion の控えを置くだけ

/* content/vocab-used.txt は執筆用の控えで、app は読まない。ここには入れない。 */
const SHELL_FILES = [
  "./",
  "index.html",
  "app.css",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-192-maskable.png",
  "icons/icon-512-maskable.png"
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    /* 一つ失敗しても install ごと落とさない。図示が欠けても本文は読める。
       ただし何が落ちたかは残す。設定の「更新を確認」で拾えるようにしておく。 */
    const r = await Promise.allSettled(SHELL_FILES.map(f => c.add(f)));
    const failed = SHELL_FILES.filter((f, i) => r[i].status === "rejected");
    if (failed.length) {
      const meta = await caches.open(META);
      await meta.put("precacheFailed", new Response(JSON.stringify({
        failed, reasons: r.filter(x => x.status === "rejected").map(x => String(x.reason))
      }), { headers: { "Content-Type": "application/json" } }));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, CONTENT, META]);
    const names = await caches.keys();
    await Promise.all(names.map(n => keep.has(n) ? null : caches.delete(n)));
    await self.clients.claim();
  })());
});

const isIndex = u => u.pathname.endsWith("/content/index.json");
const isBatch = u => /\/content\/batch\d+\.json$/.test(u.pathname);

/* index.json が新しくなっていたら、batch の cache をまとめて捨てる */
async function dropStaleContent(freshResponse) {
  try {
    const fresh = await freshResponse.clone().json();
    const meta = await caches.open(META);
    const prev = await meta.match("contentVersion");
    const prevVer = prev ? await prev.json() : null;
    if (prevVer !== fresh.contentVersion) {
      await caches.delete(CONTENT);
      await meta.put("contentVersion",
        new Response(JSON.stringify(fresh.contentVersion), {
          headers: { "Content-Type": "application/json" }
        }));
    }
  } catch (e) {
    /* 判定できなくても配信は続ける */
  }
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isIndex(url)) {
    e.respondWith((async () => {
      try {
        const net = await fetch(req, { cache: "no-cache" });
        if (net && net.ok) {
          await dropStaleContent(net);
          (await caches.open(CONTENT)).put(req, net.clone());
        }
        return net;
      } catch (err) {
        const hit = await caches.match(req);
        if (hit) return hit;
        throw err;
      }
    })());
    return;
  }

  if (isBatch(url)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const net = await fetch(req);
      if (net && net.ok) (await caches.open(CONTENT)).put(req, net.clone());
      return net;
    })());
    return;
  }

  /* app shell。ナビゲーションはオフラインでも index.html を返す */
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: req.mode === "navigate" });
    if (hit) return hit;
    try {
      const net = await fetch(req);
      if (net && net.ok && net.type === "basic") {
        (await caches.open(SHELL)).put(req, net.clone());
      }
      return net;
    } catch (err) {
      if (req.mode === "navigate") {
        const shell = await caches.match("index.html") || await caches.match("./");
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
