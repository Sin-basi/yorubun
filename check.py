#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""夜文法的自檢腳本。改完內容或 app 都跑一次，全綠才 commit。

    python check.py

檢查的是 CONTENT-SPEC.md 的規則裡機器判得動的部分，加上 app 端的
檔案完整性。判不動的（例句自不自然、reading 對不對、三個 variants
是不是同一件事）還是要人看，那三項是 QA 清單裡最容易出錯的地方。
"""
import json
import os
import re
import sys
import glob

ROOT = os.path.dirname(os.path.abspath(__file__))
C = lambda *p: os.path.join(ROOT, "content", *p)

POS = {"名", "動Ⅰ", "動Ⅱ", "動Ⅲ", "イ形", "ナ形", "副", "連体", "接続", "感動"}
LEV_H = ["くだけた", "普通", "丁寧", "改まった", "格式"]
LEV_B = ["ぼかし", "標準", "精密"]
LEVERS = ["語種", "人称の消去", "待遇表現", "接続と文末", "縮約と省略"]
# 假名、長音、和文標點。reading 欄只准這些
KANA = re.compile(r"[぀-ゟ゠-ヿ、。？ー]+")
KANJI = re.compile(r"[一-鿿]")

fails = []
warns = []


def bad(where, msg):
    fails.append(f"{where}: {msg}")


def warn(where, msg):
    warns.append(f"{where}: {msg}")


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ── 1. app 端的檔案齊不齊 ─────────────────────────────────
SHELL = ["index.html", "app.css", "app.js", "sw.js", "manifest.webmanifest",
         "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
         "icons/icon-192-maskable.png", "icons/icon-512-maskable.png"]
for f in SHELL:
    if not os.path.exists(os.path.join(ROOT, f)):
        bad("shell", f"缺檔 {f}")

# sw.js 預快取的清單要跟實際檔案一致，否則離線會缺東西。
# sw.js 自己不列進去是對的：瀏覽器另外抓它，快取住反而擋住更新。
sw = open(os.path.join(ROOT, "sw.js"), encoding="utf-8").read()
listed = set(re.findall(r'"((?:\./|[\w./-]+\.(?:html|css|js|webmanifest|png)))"', sw))
for f in SHELL:
    if f != "sw.js" and f not in listed:
        bad("sw.js", f"SHELL_FILES 沒列到 {f}")
if not re.search(r'const VERSION = "[^"]+"', sw):
    bad("sw.js", "找不到 VERSION 常數")

# ── 2. index.json 與 outline.json ────────────────────────
idx = load(C("index.json"))
outline = load(C("outline.json"))
out_days = {o["day"]: o for o in outline["days"]}

if len(out_days) != outline["totalDays"]:
    bad("outline", f"days {len(out_days)} 筆，宣稱 {outline['totalDays']} 課")
missing = [i for i in range(1, outline["totalDays"] + 1) if i not in out_days]
if missing:
    bad("outline", f"缺課號 {missing[:10]}")
if idx["totalDays"] != outline["totalDays"]:
    bad("index", "totalDays 與 outline 不一致")

# ── 3. 每一課 ────────────────────────────────────────────
lessons = []
for f in sorted(glob.glob(C("batch*.json"))):
    lessons += load(f)
lessons.sort(key=lambda x: x["day"])

toc_days = [t["day"] for t in idx["toc"]]
if toc_days != [x["day"] for x in lessons]:
    bad("index", "toc 與實際課文不一致")
for b in idx["batches"]:
    if not os.path.exists(C(b["file"])):
        bad("index", f"batches 指到不存在的 {b['file']}")

seen_vocab = {}
all_q = {}
# 例文の使い回し検出。漢字か仮名かだけ違う書き換えも同じ文として扱いたいので、
# reading（全部仮名）で突き合わせる。同じ文を別の課で出すと復習にならない。
all_ex = {}

for d in lessons:
    n = d["day"]
    w = f"day{n}"
    for k in ["day", "part", "group", "unit", "intro", "patterns", "vocab", "paraphrase", "review"]:
        if k not in d:
            bad(w, f"缺欄位 {k}")
    o = out_days.get(n)
    if not o:
        bad(w, "不在 outline 裡")
    else:
        if o["unit"] != d["unit"]:
            bad(w, f"unit 與 outline 不一致：{d['unit']} vs {o['unit']}")
        if o["part"] != d["part"]:
            bad(w, "part 與 outline 不一致")
    if not (2 <= len(d["patterns"]) <= 4):
        bad(w, f"patterns {len(d['patterns'])} 個，規格是 2 到 4")
    if len(d["vocab"]) != 5:
        bad(w, f"vocab {len(d['vocab'])} 個，規格是 5")
    if not (isinstance(d["intro"], dict) and d["intro"].get("zh")):
        bad(w, "intro 不是雙語")

    words = {v["w"] for v in d["vocab"]}
    marked = set()
    for p in d["patterns"]:
        pw = f"{w} {p.get('id')}"
        if len(p["examples"]) < 3:
            bad(pw, f"例句只有 {len(p['examples'])} 句")
        if not p.get("constraints"):
            bad(pw, "constraints 空的")
        for k in ["conjugation", "meaning", "register", "contrast"]:
            if not (isinstance(p.get(k), dict) and p[k].get("ja")):
                bad(pw, f"{k} 不是雙語物件")
        for e in p["examples"]:
            marked |= set(re.findall(r"【([^】]*)】", e["ja"]))
            r = e.get("reading", "")
            if not KANA.fullmatch(r):
                bad(pw, f"reading 混了非假名：{r[:26]}")
            if KANJI.search(r):
                bad(pw, f"reading 有漢字：{r[:26]}")
            plain = re.sub(r"[【】]", "", e["ja"])
            if not (7 <= len(plain) <= 48):
                warn(pw, f"例句長度 {len(plain)}：{plain[:24]}")
            key = re.sub(r"[、。？\s]", "", r)
            if key in all_ex and all_ex[key] != n:
                bad(pw, f"例句與 day{all_ex[key]} 重複：{plain[:24]}")
            all_ex.setdefault(key, n)
    for m in marked:
        if m not in words:
            bad(w, f"【{m}】不在本課 vocab（標記只給當課語彙）")
    if n != 1 and len(marked) < 2:
        warn(w, f"只有 {len(marked)} 個當課單字出現在文法例句（規格要 2 個以上）")

    for v in d["vocab"]:
        for part in v["pos"].split("・"):
            if part not in POS:
                bad(w, f"pos 標籤 {v['pos']} 不在固定清單（{v['w']}）")
        if v["w"] in seen_vocab:
            bad(w, f"單字 {v['w']} 與 day{seen_vocab[v['w']]} 重複")
        seen_vocab[v["w"]] = n
        if not (isinstance(v.get("note"), dict) and v["note"].get("zh")):
            bad(w, f"vocab {v['w']} 的 note 不是雙語")

    pa = d["paraphrase"]
    if re.search(r"[぀-ゟ゠-ヿ]", pa["intent"]):
        bad(w, f"intent 混進日文：{pa['intent']}")
    if pa["axis"] not in ("硬さ", "ぼかし"):
        bad(w, f"axis 值錯：{pa['axis']}")
    valid = LEV_H if pa["axis"] == "硬さ" else LEV_B
    order = []
    for v in pa["variants"]:
        if v["level"] not in valid:
            bad(w, f"level {v['level']} 不屬於 {pa['axis']} 軸")
        else:
            order.append(valid.index(v["level"]))
        if not KANA.fullmatch(v.get("reading", "")):
            bad(w, f"variant reading 混了非假名：{v.get('reading','')[:26]}")
        if not (isinstance(v.get("when"), dict) and v["when"].get("zh")):
            bad(w, f"variant {v['level']} 的 when 不是雙語")
    if order != sorted(order):
        bad(w, f"variants 沒有依級數排序：{[v['level'] for v in pa['variants']]}")
    if len(pa["variants"]) < 3:
        bad(w, "variants 少於 3 個")
    for side in ("ja", "zh"):
        t = pa["lever"][side]
        if t.count("<em>") != t.count("</em>"):
            bad(w, f"lever.{side} 的 <em> 沒配對")
        if not any(f"<em>{x}</em>" in t for x in LEVERS):
            warn(w, f"lever.{side} 沒有用 <em> 點名五個槓桿裡的任何一個")

    if len(d["review"]) not in (0, 3):
        bad(w, f"review {len(d['review'])} 題，規格是 3 題或 0 題")
    for r in d["review"]:
        if len(r["options"]) != 2 or r["answer"] not in (0, 1):
            bad(w, "複習題的選項或答案不合法")
        if r["fromDay"] >= n:
            bad(w, f"fromDay {r['fromDay']} 不小於本課")
        if set(r.get("why", {})) != {"ja", "zh"}:
            bad(w, f"why 欄位是 {sorted(r.get('why', {}))}")
        all_q.setdefault(r["q"], []).append(n)

    for ref in d.get("reference", []):
        if not isinstance(ref.get("title"), dict):
            bad(w, "reference 的 title 不是雙語")
        for row in ref["rows"]:
            if len(row) != len(ref["cols"]):
                bad(w, f"reference 表格列寬不符：{row}")

for q, days in all_q.items():
    if len(days) > 1:
        bad("review", f"複習題跨課重複（day{days}）：{q[:28]}")

# ── 4. 摘要 ──────────────────────────────────────────────
ax = {}
for d in lessons:
    ax[d["paraphrase"]["axis"]] = ax.get(d["paraphrase"]["axis"], 0) + 1
used = os.path.join(ROOT, "content", "vocab-used.txt")
if os.path.exists(used):
    listed_words = [x for x in open(used, encoding="utf-8").read().split() if x]
    if listed_words != [v["w"] for d in lessons for v in d["vocab"]]:
        bad("vocab-used.txt", "與實際課文的單字不一致，重新產生一次")

print(f"課數 {len(lessons)} / {outline['totalDays']}"
      f"｜contentVersion {idx['contentVersion']}"
      f"｜單字 {len(seen_vocab)}"
      f"｜複習題 {sum(len(d['review']) for d in lessons)}"
      f"｜軸 {ax}")

for x in warns:
    print("  warn  " + x)
if fails:
    print(f"\nFAIL {len(fails)} 項")
    for x in fails:
        print("  " + x)
    sys.exit(1)
print(f"\nOK{'（有 ' + str(len(warns)) + ' 項提醒）' if warns else ''}")
print("機器判不動、要自己看的三項：reading 逐句、例句自不自然、"
      "言い換え三句是不是同一件事")
