#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""content/ を batch ファイルから組み直す。新しい批を足したら必ず一度走らせる。

    python sync.py            # index.json と vocab-used.txt を作り直す
    python sync.py --no-bump  # contentVersion を上げずに作り直す

やること：
  - content/index.json の batches、toc を batch*.json から再生成
  - contentVersion を一つ上げる（sw.js がこれを見て content の cache を捨てる）
  - content/vocab-used.txt を課順で書き直す

sw.js の VERSION は触らない。あれは shell（index.html / app.css / app.js /
manifest / icons）を変えたときだけ手で上げる。内容だけの更新は
contentVersion で足りる。
"""
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
C = lambda *p: os.path.join(ROOT, "content", *p)

bump = "--no-bump" not in sys.argv

idx = json.load(open(C("index.json"), encoding="utf-8"))

batches, toc, vocab = [], [], []
for path in sorted(glob.glob(C("batch*.json"))):
    days = json.load(open(path, encoding="utf-8"))
    days.sort(key=lambda d: d["day"])
    batches.append({
        "file": os.path.basename(path),
        "days": [days[0]["day"], days[-1]["day"]],
    })
    for d in days:
        toc.append({k: d[k] for k in ("day", "part", "group", "unit")})
        vocab += [v["w"] for v in d["vocab"]]

toc.sort(key=lambda t: t["day"])
idx["batches"] = batches
idx["toc"] = toc
if bump:
    idx["contentVersion"] += 1

with open(C("index.json"), "w", encoding="utf-8", newline="\n") as f:
    json.dump(idx, f, ensure_ascii=False, indent=1)
    f.write("\n")

with open(C("vocab-used.txt"), "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(vocab) + "\n")

print(f"batches {len(batches)}｜課 {len(toc)}｜単語 {len(vocab)}"
      f"｜contentVersion {idx['contentVersion']}{'' if bump else '（据え置き）'}")
