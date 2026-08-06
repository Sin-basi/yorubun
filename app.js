/* 夜文法 ｜ app 本體。
   無框架無打包，改完直接推。畫面流程與儲存結構見 pm-lab 的 APP-SPEC.md。

   三個畫面：home（首頁）、lesson（一課的卡片流）、settings（設定）。
   內容全部來自 content/ 的靜態 JSON，執行期不呼叫任何 API。 */
"use strict";

const app = document.getElementById("app");
const root = document.documentElement;

/* ══ 儲存 ════════════════════════════════════════════════════ */

const KEY = "yorubun";
const SCHEMA = 1;

const defaults = () => ({
  schemaVersion: SCHEMA,
  currentDay: null,      // 開頭未定，讀完 index.json 後補第一課
  currentCard: 0,
  completed: {},         // { "1": "2026-08-06" }
  history: [],           // { day, fromDay, qIndex, correct }
  settings: { dir: "joyato", reading: true, zh: true, fontSize: "normal" }
});

let S = defaults();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    if (o && o.schemaVersion === SCHEMA) {
      S = Object.assign(defaults(), o);
      S.settings = Object.assign(defaults().settings, o.settings || {});
    }
  } catch (e) {
    /* 壞掉就當第一次開，不要讓使用者卡在白畫面 */
    console.warn("進度讀取失敗，改用預設值", e);
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {
    console.warn("進度寫入失敗", e);
  }
}

function applySettings() {
  root.dataset.dir = S.settings.dir;
  root.dataset.fs = S.settings.fontSize;
  root.dataset.rd = S.settings.reading ? "1" : "0";
  root.dataset.zh = S.settings.zh ? "1" : "0";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = getComputedStyle(root).getPropertyValue("--bg").trim() || "#191512";
  }
}

const today = () => {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* ══ 內容 ════════════════════════════════════════════════════ */

let INDEX = null;               // content/index.json
const BATCH = new Map();        // day -> 課物件

async function loadIndex() {
  const r = await fetch("content/index.json", { cache: "no-cache" });
  if (!r.ok) throw new Error("index.json " + r.status);
  INDEX = await r.json();
}

async function loadDay(day) {
  if (BATCH.has(day)) return BATCH.get(day);
  const b = (INDEX.batches || []).find(x => day >= x.days[0] && day <= x.days[1]);
  if (!b) throw new Error("找不到第 " + day + " 課所屬的批次");
  const r = await fetch("content/" + b.file);
  if (!r.ok) throw new Error(b.file + " " + r.status);
  (await r.json()).forEach(d => BATCH.set(d.day, d));
  if (!BATCH.has(day)) throw new Error("第 " + day + " 課尚未產出");
  return BATCH.get(day);
}

/* toc 是「已經產出的課」的權威清單，沒產的課不會出現在裡面 */
const availableDays = () => (INDEX.toc || []).map(t => t.day).sort((a, b) => a - b);
const tocOf = day => (INDEX.toc || []).find(t => t.day === day);
const nextDayAfter = day => availableDays().find(d => d > day) ?? null;
const firstUndone = () => availableDays().find(d => !S.completed[d]) ?? null;

/* ══ 小工具 ══════════════════════════════════════════════════ */

const esc = s => String(s).replace(/[&<]/g, m => ({ "&": "&amp;", "<": "&lt;" }[m]));
/* 雙語欄位：字串視為只有日文，物件則日文在上中文在下。
   contrast 與 lever 帶 <em>，所以這裡刻意不跳脫，內容是自己產的。 */
const bi = o => !o ? "" : (typeof o === "string" ? o : o.ja + (o.zh ? `<span class="zhx">${o.zh}</span>` : ""));

const LEVELS = ["くだけた", "普通", "丁寧", "改まった", "格式"];
/* 字體承載語感軸線：くだけた 到 丁寧 用ゴシック，改まった 以上用明朝 */
const GOTHIC = new Set(["くだけた", "普通", "丁寧"]);

const ARROW_L = '<svg width="15" height="15" viewBox="0 0 19 19" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 4.5 6.5 9.5l5 5"/></svg>';
const ARROW_R = '<svg width="15" height="15" viewBox="0 0 19 19" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 4.5 12.5 9.5l-5 5"/></svg>';
const BACKARROW = '<svg width="21" height="21" viewBox="0 0 19 19" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 4.5 6.5 9.5l5 5"/></svg>';
const SCALEMARK = '<svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" style="color:var(--sig)"><path d="M.5 8h14M3 8V4M7.5 8V2.5M12 8V5"/></svg>';
const REVMARK = '<svg width="13" height="10" viewBox="0 0 13 10" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="color:var(--tx3)"><path d="M12.5 1v2.5a2 2 0 0 1-2 2H1.5M4 3 1.5 5.5 4 8"/></svg>';
const dayMark = n => `<div class="mk mute">${String(n).padStart(3, "0")}</div>`;

/* 文型例句裡出現當課單字就標起來。只做完全一致的比對，
   活用後的形（記入して 之類）不標，寧可漏標也不要標錯位置。 */
function markVocab(escaped, words) {
  let out = escaped;
  words.slice().sort((a, b) => b.length - a.length).forEach(w => {
    if (!w) return;
    out = out.split(esc(w)).join(`<mark>${esc(w)}</mark>`);
  });
  return out;
}

/* ══ 卡片序列 ════════════════════════════════════════════════ */

function cards(d) {
  const c = [{ t: "topic" }];
  d.patterns.forEach((p, i) => { c.push({ t: "pattern", i }); c.push({ t: "cons", i }); });
  d.vocab.forEach((v, i) => c.push({ t: "vocab", i }));
  c.push({ t: "para" });
  (d.review || []).forEach((r, i) => c.push({ t: "review", i }));
  c.push({ t: "done" });
  return c;
}

/* ══ 畫面狀態 ════════════════════════════════════════════════ */

let view = "home";        // home | lesson | settings
let lesson = null;        // 目前這一課的內容物件
let idx = 0, stage = 0;
let answered = {};        // 這一輪的作答，key 是複習題序號

/* ══ 首頁 ════════════════════════════════════════════════════ */

function renderHome() {
  const day = S.currentDay;
  const t = tocOf(day);
  if (!t) return renderState("内容がありません", "content/index.json に読める課がない。");

  const done = !!S.completed[day];
  const doneToday = S.completed[day] === today();
  const nx = nextDayAfter(day);
  const nxt = nx && !S.completed[nx] ? tocOf(nx) : null;
  const resuming = !done && S.currentCard > 0;

  let btn, sub = "";
  if (doneToday) {
    btn = "もう一度読む";
    sub = nxt
      ? `<div class="next">明日は <b>第 ${nx} 課　${esc(nxt.unit)}</b><br>
         <button class="lnk" id="skip" style="padding-top:8px">今すぐ次の課へ ›</button></div>`
      : `<div class="next">ここまでが今ある分。続きができたらまた。</div>`;
  } else if (done) {
    /* 済んでいるのに次の課がない＝出来ている分を読みきった状態。
       急かす文言は置かない。読み返したいときのための入口だけ残す。 */
    btn = "もう一度読む";
    sub = `<div class="next">ここまでが今ある分。続きができたらまた。</div>`;
  } else if (resuming) {
    btn = "つづきから";
    sub = `<div class="next">前回は <b>${S.currentCard + 1} 枚目</b>で閉じた。</div>`;
  } else {
    btn = "はじめる";
  }

  /* iOS は beforeinstallprompt がないので、未インストールのときだけ手順を出す */
  const standalone = window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  const install = standalone ? "" : `<div class="install">
    <b>ホーム画面に追加しておく</b>
    共有ボタンから「ホーム画面に追加」。Safari とは進度の保存先が別なので、
    読みはじめる前に済ませておくほうがいい。</div>`;

  app.innerHTML = `
    <div class="center fade">
      <div class="daynum">第 ${day} 課　／　${INDEX.totalDays} 課</div>
      <div class="big">${esc(t.unit)}</div>
      <div class="grp">${esc(t.group)}</div>
      ${sub}
    </div>
    ${install}
    <div class="links">
      <button class="btn" id="go">${btn}</button>
      <div class="spacer"></div>
      <button class="lnk" id="settings">設定</button>
    </div>`;

  document.getElementById("go").onclick = () => startLesson(day, resuming ? S.currentCard : 0);
  document.getElementById("settings").onclick = () => { view = "settings"; render(); };
  const sk = document.getElementById("skip");
  if (sk) sk.onclick = () => { S.currentDay = nx; S.currentCard = 0; save(); startLesson(nx, 0); };
}

/* ══ 一課 ════════════════════════════════════════════════════ */

async function startLesson(day, at) {
  renderState("読み込み中", "");
  try {
    lesson = await loadDay(day);
  } catch (e) {
    return renderState("この課はまだ", String(e.message || e));
  }
  const seq = cards(lesson);
  idx = Math.min(Math.max(at | 0, 0), seq.length - 1);
  stage = 0;
  answered = {};
  view = "lesson";
  render();
}

function railHTML(n, cur) {
  let s = '<div class="rail">';
  for (let i = 0; i < n; i++) s += `<i class="${i < cur ? "done" : i === cur ? "now" : ""}"></i>`;
  return s + "</div>";
}

function exHTML(list, mincho, words) {
  return '<ul class="ex">' + list.map(e =>
    `<li><div class="ja${mincho ? "" : " go"}">${markVocab(esc(e.ja), words || [])}</div>` +
    `<div class="rd">${esc(e.reading || "")}</div><div class="zh">${esc(e.zh)}</div></li>`
  ).join("") + "</ul>";
}

function renderLesson() {
  const d = lesson, seq = cards(d), c = seq[idx];
  let margin = "", body = "", foot = "", tap = true;
  const words = (d.vocab || []).map(v => v.w);

  if (c.t === "topic") {
    margin = dayMark(d.day);
    body = `<div class="lbl">${esc(d.group)}</div>
      <h1 class="h1" style="margin-top:10px;font-family:var(--f-mi)">${esc(d.unit)}</h1>
      <p class="intro">${bi(d.intro)}</p>`;
  }
  else if (c.t === "pattern") {
    const p = d.patterns[c.i];
    margin = dayMark(d.day) + `<div class="mk">${esc(p.id)}</div><div class="mtick on"></div>`;
    body = `<div class="h2">${esc(p.pattern)}</div>
      <div class="meta">
        <div><b>接続</b><span>${bi(p.conjugation)}</span></div>
        <div><b>意味</b><span>${bi(p.meaning)}</span></div>
        <div><b>文体</b><span>${bi(p.register)}</span></div>
      </div>
      ${exHTML(p.examples, true, words)}`;
  }
  else if (c.t === "cons") {
    const p = d.patterns[c.i];
    margin = dayMark(d.day) + `<div class="mk">${esc(p.id)}</div><div class="mtick"></div>`;
    body = `<div class="lbl">使い分けの境界</div>
      <div class="h2" style="margin-top:8px;font-size:1.375rem">${esc(p.pattern)}</div>
      <ul class="cons">${(p.constraints || []).map(x => `<li>${bi(x)}</li>`).join("")}</ul>
      ${p.contrast ? `<div class="contrast">${bi(p.contrast)}</div>` : ""}`;
  }
  else if (c.t === "vocab") {
    const v = d.vocab[c.i];
    margin = dayMark(d.day) + `<div class="mk">${String(c.i + 1).padStart(2, "0")}</div>`;
    body = `<div class="lbl">語彙 ${c.i + 1} / ${d.vocab.length}</div>
      <div class="word" style="margin-top:14px">
        <div class="w">${esc(v.w)}</div><div class="pos">${esc(v.pos)}</div>
      </div>
      <div class="wr">${esc(v.r)}</div>
      <div class="wz">${esc(v.zh)}</div>
      ${v.ex ? `<div class="ex" style="margin-top:22px"><li style="list-style:none">
        <div class="ja">${markVocab(esc(v.ex.ja), [v.w])}</div>
        <div class="zh">${esc(v.ex.zh)}</div></li></div>` : ""}
      ${v.note ? `<div class="note">${bi(v.note)}</div>` : ""}`;
  }
  else if (c.t === "para") {
    const p = d.paraphrase;
    margin = dayMark(d.day) + SCALEMARK;
    const used = p.variants.map(v => LEVELS.indexOf(v.level));
    let sc = '<div class="scale"><div class="bar">';
    LEVELS.forEach((l, i) => {
      const x = (i / (LEVELS.length - 1)) * 100;
      const on = stage >= 1 && used.includes(i);
      sc += `<div class="tick${on ? " on" : ""}" style="left:${x}%"></div>`;
      sc += `<div class="cap${on ? " on" : ""}" style="left:${x}%">${esc(l)}</div>`;
    });
    sc += "</div></div>";
    const anchor = p.variants.find(v => v.level === "丁寧") || p.variants[1] || p.variants[0];
    body = `<div class="lbl">言い換え ｜ ${esc(p.axis)}の軸</div>${sc}
      <div class="intent"><b>伝えたい内容</b>${esc(p.intent)}</div>`;
    if (stage === 0) {
      body += `<div class="vlist"><div class="vitem anchor">
        <div class="vlvl">いま言えるところ</div>
        <div class="ja${GOTHIC.has(anchor.level) ? " go" : ""}">${esc(anchor.ja)}</div>
        <div class="rd">${esc(anchor.reading || "")}</div></div></div>
        <div class="ask">${p.axis === "硬さ"
          ? "もっとくだけては？　もっと改まっては？"
          : "もっとぼかすには？　もっと精密にするには？"}</div>
        <div class="hint">口に出さなくていい。心の中で一度言ってから進む。</div>`;
    } else if (stage === 1) {
      body += '<div class="vlist">' + p.variants.map(v =>
        `<div class="vitem"><div class="vlvl">${esc(v.level)}</div>
        <div class="ja${GOTHIC.has(v.level) ? " go" : ""}">${esc(v.ja)}</div>
        <div class="rd">${esc(v.reading || "")}</div><div class="zh">${esc(v.zh)}</div>
        <div class="vwhen">${bi(v.when)}</div></div>`).join("") + "</div>";
    } else {
      /* 第三段：variants 收合成精簡版，把 lever 拉進第一屏。
         槓桿說明才是要學的東西，句子只是例子。 */
      body += '<div class="vlist slim">' + p.variants.map(v =>
        `<div class="vitem"><div class="vlvl">${esc(v.level)}</div>
        <div class="ja${GOTHIC.has(v.level) ? " go" : ""}">${esc(v.ja)}</div></div>`).join("") + "</div>" +
        `<div class="lever"><b>何が効いたか　この差はどこから来たか</b><p>${bi(p.lever)}</p></div>`;
    }
  }
  else if (c.t === "review") {
    const r = d.review[c.i], a = answered[c.i];
    margin = dayMark(d.day) + REVMARK + `<div class="mk mute">${String(r.fromDay).padStart(3, "0")}</div>`;
    body = `<div class="lbl">かるい復習 ${c.i + 1} / ${d.review.length}</div>
      <div class="q">${esc(r.q)}</div><div class="opts">` +
      r.options.map((o, i) => {
        let cl = "opt";
        if (a !== undefined) cl += i === r.answer ? " ok" : (i === a ? " ng" : "");
        return `<button class="${cl}" data-opt="${i}" ${a !== undefined ? "disabled" : ""}>${esc(o)}</button>`;
      }).join("") + "</div>" +
      (a !== undefined ? `<div class="why">${bi(r.why)}</div>` : "");
  }
  else if (c.t === "done") {
    margin = dayMark(d.day);
    const nx = nextDayAfter(d.day), nxt = nx ? tocOf(nx) : null;
    body = `<div class="daynum">第 ${d.day} 課　完了</div>
      <div class="big" style="font-size:1.94rem">${esc(d.unit)}</div>
      <div style="margin-top:26px;display:flex;flex-direction:column;gap:11px">
      ${d.patterns.map(p => `<div style="display:flex;gap:11px;align-items:baseline">
        <span class="lbl" style="width:2.2em;flex-shrink:0">${esc(p.id)}</span>
        <span style="font-family:var(--f-mi);font-size:1.22rem">${esc(p.pattern)}</span></div>`).join("")}
      </div>
      <div class="grp" style="margin-top:32px">${nxt ? `明日：第 ${nx} 課　${esc(nxt.unit)}` : "ここまでが今ある分"}</div>`;
    tap = false;
    foot = `<button class="btn ghost" id="again">もう一度</button><div class="spacer"></div>
            <button class="btn" id="home">おわり</button>`;
  }

  const total = seq.length;
  /* 第一枚で左を押したらホームへ戻る。standalone にはブラウザの戻るがないので、
     どの画面からも指一本で出られる道を必ず残す。 */
  const atStart = idx === 0 && stage === 0;
  if (!foot) foot = `<div class="navhint">${ARROW_L}<span>${atStart ? "ホーム" : "もどる"}</span></div>
    <div class="spacer"></div>
    <div class="count">${String(idx + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div>
    <div class="spacer"></div>
    <div class="navhint"><span>${c.t === "para" && stage < 2 ? "つづき" : "すすむ"}</span>${ARROW_R}</div>`;

  app.innerHTML = railHTML(total, idx) +
    `<div class="stage"><div class="margin">${margin}</div>
     <div class="body"><div class="inner fade${c.t === "topic" || c.t === "done" ? " mid" : ""}">${body}</div></div></div>
     <div class="foot">${foot}</div>` +
    (tap ? '<div class="tapzone tprev" id="tzp"></div><div class="tapzone tnext" id="tzn"></div>' : "");

  const tzp = document.getElementById("tzp"), tzn = document.getElementById("tzn");
  if (tzp) tzp.onclick = () => { if (Date.now() - swipedAt > 400) prev(); };
  if (tzn) tzn.onclick = () => { if (Date.now() - swipedAt > 400) next(); };

  app.querySelectorAll("[data-opt]").forEach(el => el.onclick = e => {
    e.stopPropagation();
    const r = lesson.review[c.i], pick = +el.dataset.opt;
    answered[c.i] = pick;
    S.history.push({ day: lesson.day, fromDay: r.fromDay, qIndex: c.i, correct: pick === r.answer });
    save();
    render();
  });
  const ag = document.getElementById("again");
  if (ag) ag.onclick = () => { idx = 0; stage = 0; answered = {}; S.currentCard = 0; save(); render(); };
  const hm = document.getElementById("home");
  if (hm) hm.onclick = finishLesson;
}

function finishLesson() {
  S.completed[lesson.day] = today();
  S.currentDay = lesson.day;   // 今日の分としてホームに残す。日付が変わったら起動時に進む
  S.currentCard = 0;
  save();
  view = "home";
  render();
}

function next() {
  const seq = cards(lesson), c = seq[idx];
  if (c.t === "para" && stage < 2) { stage++; render(); return; }
  if (idx < seq.length - 1) {
    idx++; stage = 0;
    if (!S.completed[lesson.day]) { S.currentDay = lesson.day; S.currentCard = idx; save(); }
    render();
  }
}

function prev() {
  const seq = cards(lesson), c = seq[idx];
  if (c.t === "para" && stage > 0) { stage--; render(); return; }
  if (idx > 0) {
    idx--; stage = seq[idx].t === "para" ? 2 : 0;
    if (!S.completed[lesson.day]) { S.currentCard = idx; save(); }
    render();
  } else {
    view = "home"; render();
  }
}

/* ══ 設定 ════════════════════════════════════════════════════ */

let settingsMsg = null;
/* textarea の中身は再描画をまたいで残す。書き出した直後に render() が
   走って消える事故があったので、値は DOM ではなくここに持つ。 */
let taValue = "";

function segRow(title, desc, opts, current, onPick) {
  return { title, desc, opts, current, onPick };
}

function renderSettings() {
  const rows = [
    segRow("配色", "睡前の光の色。いつでも変えられる。",
      [["hanshita", "版下"], ["joyato", "常夜灯"]], S.settings.dir,
      v => { S.settings.dir = v; }),
    segRow("読み", "例文のかな。要らなくなったら切る。",
      [[true, "表示"], [false, "非表示"]], S.settings.reading,
      v => { S.settings.reading = v; }),
    segRow("中国語", "文法説明の中文。例文の訳はこれとは別で常に出る。",
      [[true, "表示"], [false, "非表示"]], S.settings.zh,
      v => { S.settings.zh = v; }),
    segRow("字の大きさ", "", [["normal", "標準"], ["large", "大"]], S.settings.fontSize,
      v => { S.settings.fontSize = v; })
  ];

  app.innerHTML = `
    <div class="bar">
      <button class="back" id="back">${BACKARROW}</button>
      <h2>設定</h2>
    </div>
    <div class="sheet fade">
      ${rows.map((r, ri) => `<div class="row">
        <div class="rl"><b>${esc(r.title)}</b>${r.desc ? `<small>${esc(r.desc)}</small>` : ""}</div>
        <div class="seg">${r.opts.map((o, oi) =>
          `<button data-r="${ri}" data-o="${oi}" class="${o[0] === r.current ? "on" : ""}">${esc(o[1])}</button>`
        ).join("")}</div>
      </div>`).join("")}

      <div class="row" style="display:block">
        <div class="rl"><b>進度のバックアップ</b>
          <small>書き出したテキストを控えておけば、別のブラウザや機種変のあとで戻せる。
          月に一度くらいで足りる。</small></div>
        <div class="btnrow">
          <button class="btn ghost sm" id="exp">書き出す</button>
          <button class="btn ghost sm" id="imp">貼り付けた内容を読み込む</button>
        </div>
        <textarea class="ta" id="ta" spellcheck="false"
          placeholder="ここに書き出される。読み込むときは、控えておいたテキストをここに貼ってから左のボタン。">${esc(taValue)}</textarea>
        ${settingsMsg ? `<div class="msg${settingsMsg.bad ? " bad" : ""}">${esc(settingsMsg.text)}</div>` : ""}
      </div>

      <div class="row" style="display:block">
        <div class="rl"><b>内容</b>
          <small>版 ${INDEX ? INDEX.contentVersion : "?"} ／ 今ある課 ${INDEX ? availableDays().length : 0} 課
          （全 ${INDEX ? INDEX.totalDays : "?"} 課の予定）</small></div>
        <div class="btnrow"><button class="btn ghost sm" id="upd">更新を確認</button></div>
      </div>

      <div class="note-sm">
        ホーム画面に追加した app と Safari では、進度の保存先が別になる。
        Safari で読んだ分はホーム画面の app には引き継がれないので、
        移すときは上の書き出しと読み込みを使う。<br><br>
        Safari は七日ぶりに開いたサイトの保存データを消すことがある。
        ホーム画面に追加してあれば消えにくいが、保証はない。
      </div>
    </div>`;

  document.getElementById("back").onclick = () => { settingsMsg = null; view = "home"; render(); };

  app.querySelectorAll("[data-r]").forEach(b => b.onclick = () => {
    rows[+b.dataset.r].onPick(rows[+b.dataset.r].opts[+b.dataset.o][0]);
    save(); applySettings(); render();
  });

  const ta = document.getElementById("ta");
  ta.oninput = () => { taValue = ta.value; };
  document.getElementById("exp").onclick = () => {
    taValue = JSON.stringify(S);
    settingsMsg = { text: "書き出した。ぜんぶ選択してあるので、そのままコピー。" };
    render();
    const t = document.getElementById("ta");
    if (t) { t.focus(); t.select(); }
  };
  document.getElementById("imp").onclick = () => {
    const raw = (ta.value || "").trim();
    taValue = ta.value;
    if (!raw) { settingsMsg = { text: "先に控えておいたテキストを貼る。", bad: true }; return render(); }
    try {
      const o = JSON.parse(raw);
      if (!o || o.schemaVersion !== SCHEMA) throw new Error("形式が合わない");
      S = Object.assign(defaults(), o);
      S.settings = Object.assign(defaults().settings, o.settings || {});
      save(); applySettings();
      settingsMsg = { text: `読み込んだ。済んだ課 ${Object.keys(S.completed).length} 課。` };
    } catch (e) {
      settingsMsg = { text: "読み込めなかった：" + (e.message || e), bad: true };
    }
    render();
  };
  document.getElementById("upd").onclick = async () => {
    settingsMsg = { text: "確認中…" };
    render();
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.update();
      const r = await fetch("content/index.json", { cache: "reload" });
      const j = await r.json();
      const grew = j.contentVersion !== (INDEX && INDEX.contentVersion);
      INDEX = j;
      settingsMsg = { text: grew ? "新しい内容があった。閉じて開き直すと入れ替わる。" : "今のが最新。" };
    } catch (e) {
      settingsMsg = { text: "確認できなかった。つながっていないだけかもしれない。", bad: true };
    }
    render();
  };
}

/* ══ 共通 ════════════════════════════════════════════════════ */

function renderState(title, detail) {
  app.innerHTML = `<div class="state fade">
    <div class="big-sm">${esc(title)}</div>
    ${detail ? `<div style="font-size:.88rem">${esc(detail)}</div>` : ""}
    ${view !== "home" ? '<button class="btn ghost sm" id="hm2" style="margin-top:8px">ホームへ</button>' : ""}
  </div>`;
  const h = document.getElementById("hm2");
  if (h) h.onclick = () => { view = "home"; render(); };
}

function render() {
  if (view === "home") renderHome();
  else if (view === "lesson") renderLesson();
  else if (view === "settings") renderSettings();
  window.scrollTo(0, 0);
}

/* キーボードは机の上で確認するとき用。実機では使わない */
document.addEventListener("keydown", e => {
  if (view !== "lesson") return;
  if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
  if (e.key === "ArrowLeft") prev();
});

/* 左右スワイプ。縦スクロール優先、斜めは効かせない */
let sx = 0, sy = 0, swipedAt = 0;
app.addEventListener("touchstart", e => {
  const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY;
}, { passive: true });
app.addEventListener("touchend", e => {
  if (view !== "lesson") return;
  const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) {
    swipedAt = Date.now();
    if (dx < 0) next(); else prev();
  }
}, { passive: true });

/* ══ 起動 ════════════════════════════════════════════════════ */

async function boot() {
  load();
  applySettings();
  renderState("読み込み中", "");
  try {
    await loadIndex();
  } catch (e) {
    return renderState("内容が読めない", String(e.message || e));
  }

  const days = availableDays();
  if (!days.length) return renderState("内容がまだない", "content/index.json の toc が空。");

  /* 済んだ課は当日いっぱいホームに残す。日付が変わっていたら次の課へ進める。
     日付で強制はしない。読まなかった日があっても課は飛ばない。 */
  if (S.currentDay == null || !days.includes(S.currentDay)) {
    S.currentDay = firstUndone() ?? days[days.length - 1];
    S.currentCard = 0;
  } else if (S.completed[S.currentDay] && S.completed[S.currentDay] !== today()) {
    const nx = firstUndone();
    if (nx != null) { S.currentDay = nx; S.currentCard = 0; }
  }
  save();

  view = "home";
  render();

  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("sw.js"); }
    catch (e) { console.warn("service worker 未登録", e); }
  }
}

boot();
