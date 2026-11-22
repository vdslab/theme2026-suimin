"""RoasterDB の味タグを集計するスクリプト（suimin）

使い方（リポジトリのルートで実行）:
    python3 scripts/flavor_analysis.py               # 集計 + 焙煎/産地の分析（数分かかる）
    python3 scripts/flavor_analysis.py --boot 0      # 揺れの計算を省いて速く試す（分類は参考程度）
    python3 scripts/flavor_analysis.py --sample 50   # 人の目で確認するためのサンプルCSVも書き出す

出力（すべて data/private/analysis/ 。Git 管理外なのでコミットされない）:
    flavor_summary.json   サイト用の集計値（味 × 産地・焙煎度・精製方法の件数）
    roast_origin.csv      味ごとの「焙煎で説明できる割合」「産地で説明できる割合」と分類
    tag_check_sample.csv  --sample を付けたときだけ。説明文と味タグを並べた確認用の表
"""
import argparse, csv, json, math, os, random, re, sqlite3
from collections import Counter, defaultdict

DB = "data/private/roasterdb/2026.10/roasterdb.sqlite"
OUT = "data/private/analysis"
ROAST3 = {"Light": "浅", "Light-Medium": "浅", "Medium": "中", "Medium-Dark": "深", "Dark": "深"}
PROCESSES = ["Washed", "Natural", "Honey", "Anaerobic"]  # "Other" は除く

# ---- 補正ルール ---------------------------------------------------------
# 1. Honey: ハニー製法（honey process, red/yellow/black/white/anaerobic honey, dried as a honey 等）を除外
HONEY_PROCESS = re.compile(
    r"\b("
    r"honey[\s-]*(process|processed|processing|method|lot|prep|preparation|ferment\w*)"
    r"|(white|yellow|gold|golden|red|black|pink|anaerobic|double\s+anaerobic|natural|washed|pulped|semi)[\s-]+honey"
    r"|dried\s+as\s+(a\s+)?honey"
    r"|process(ing|ed)?\s*[:\-|]\s*[^\n.;,]*?\bhoney"
    r")\b",
    re.I,
)
HONEY_WORD = re.compile(r"\bhoney\b", re.I)

# 2. Cherry: 収穫・精製工程における原料の「コーヒーチェリー（coffee cherry, whole cherry, cherry maturation 等）」を除外
CHERRY_FALSE = re.compile(
    r"\b("
    r"coffee\s+cherry"
    r"|whole\s+cherry"
    r"|in-cherry"
    r"|(in|within|with|of|from|their|its)\s+(the\s+|its\s+)?cherry\b(?!\s*(notes?|flavou?rs?|aromas?|sweetness|acidity|jam|cola|pie|cobbler|blossom|compote|liqueur|syrup))"
    r"|cherry\s+(integrity|intake|matur\w*|ripen\w*|harvest\w*|pick\w*|handpick\w*|deliver\w*|select\w*|sort\w*|float\w*|pulp\w*|ferment\w*|dry\w*|dried|wash\w*|process\w*|skin|mucilage|reception|collection|stage|intact|weight|lot|lots|price|prices|buying|purchase\w*|farmers?|producers?|trees?|flotation|oxidation|development|handling|supply|collector|clerk|mosto|fruit)"
    r"|cherry\s+(is|was|are|were|for\s+this\s+lot|from\s+each|from\s+local|from\s+small\w*|from\s+farmers|from\s+around)"
    r"|(deliver\w*|harvest\w*|handpick\w*|hand-pick\w*|float\w*|pulp\w*|depulp\w*|ferment\w*|process\w*|wash\w*|collect\w*|contribut\w*|receiv\w*|buy|buying|purchas\w*|pick|picked|picking|hand-sorted|managed|every|each|own|catuai|bourbon)\s+(the\s+|their\s+|ripe\s+|red\s+|fresh\s+|freshly\s+|picked\s+|whole\s+|coffee\s+){0,2}cherry"
    r"|dried\s+(whole\s+)?in\s+(the\s+|its\s+|whole\s+)?cherry"
    r"|slow(er|s)?\s+(the\s+ripening\s+of\s+every\s+)?cherry"
    r"|la\s+cereza\s*\(\s*the\s+cherry\s*\)"
    r")\b",
    re.I,
)
CHERRY_WORD = re.compile(r"\bcherry\b", re.I)

# 3. Orange: 花の香り「orange blossom（オレンジの花）」の部分一致による Orange の重複付与を除外
ORANGE_FALSE = re.compile(r"\borange[\s-]+blossoms?\b", re.I)
ORANGE_WORD = re.compile(r"\boranges?\b", re.I)

# 4. Apple: 花の香り「apple blossom（りんごの花）」や別果実（custard/sugar/star/rose/cashew apple）を除外
APPLE_FALSE = re.compile(
    r"\b(apple[\s-]+blossoms?|(custard|sugar|star|rose|mammy|cashew|water|malay|wood|pond|kei)[\s-]+apples?)\b",
    re.I,
)
APPLE_WORD = re.compile(r"\bapples?\b", re.I)

# 5. Rose: 動詞 rise の過去形 rose（rose to prominence, popularity ... rose 等）や品種名・固有名詞（Bourbon Rose 等）を除外
ROSE_FALSE = re.compile(
    r"\b("
    r"rose\s+(to|from|up|above|out|in\s+popularity|quickly|rapidly|again|by)"
    r"|(popularity|temperature|prices?|sun|smoke|steam|skating|coffee|varietal|sl-?28)\s+rose"
    r"|bourbon\s+rose"
    r"|flamant\s+rose"
    r"|rose\s+dos\s+santos"
    r"|santa\s+rose"
    r"|rose\s+(street|crop|production|apple)"
    r")\b",
    re.I,
)
ROSE_WORD = re.compile(r"\brose\b", re.I)

def keep_tag(descriptor, raw):
    """タグを残すなら True。新しい補正ルールはここに足す。"""
    if descriptor == "Honey":
        # 説明文にハニー製法以外の形で honey が出てくるときだけ残す
        return bool(HONEY_WORD.search(HONEY_PROCESS.sub("", raw)))
    if descriptor == "Cherry":
        # 説明文内の cherry がすべて原料のコーヒーチェリー（収穫・精製）の記述である場合は除外
        if CHERRY_WORD.search(raw) and not CHERRY_WORD.search(CHERRY_FALSE.sub("", raw)):
            return False
    elif descriptor == "Orange":
        # 説明文内の orange がすべて orange blossom（オレンジの花）の一部である場合は除外
        if ORANGE_WORD.search(raw) and not ORANGE_WORD.search(ORANGE_FALSE.sub("", raw)):
            return False
    elif descriptor == "Apple":
        # 説明文内の apple がすべて apple blossom や custard apple 等の一部である場合は除外
        if APPLE_WORD.search(raw) and not APPLE_WORD.search(APPLE_FALSE.sub("", raw)):
            return False
    elif descriptor == "Rose":
        # 説明文内の rose がすべて動詞の過去形や品種名（Bourbon Rose）・人名等である場合は除外
        if ROSE_WORD.search(raw) and not ROSE_WORD.search(ROSE_FALSE.sub("", raw)):
            return False
    return True

# ---- データ読み込み -------------------------------------------------------
def load(db):
    con = sqlite3.connect(db)
    beans = {}
    for bid, roaster, name, c, p, r, raw in con.execute(
        "select b.bean_id, ro.name, b.name, trim(coalesce(b.origin_country,'')), b.process_method, "
        "b.roast_level, coalesce(b.tasting_notes_raw,'') from coffee_beans b join roasters ro using(roaster_id)"):
        beans[bid] = {"roaster": roaster, "name": name, "country": c, "process": p,
                      "roast": ROAST3.get(r), "raw": raw}
    tags = defaultdict(set)   # bean_id -> {"L1:Fruity", "L2:Fruity>Berry", "L3:Blueberry", ...}
    dropped = Counter()
    for bid, cat, sub, d in con.execute(
        "select f.bean_id, n.category, n.subcategory, n.descriptor "
        "from bean_flavors f join sca_flavor_nodes n using(flavor_id)"):
        if not keep_tag(d, beans[bid]["raw"]):
            dropped[d] += 1
            continue
        tags[bid] |= {f"L1:{cat}", f"L2:{cat}>{sub}", f"L3:{d}"}
    return beans, tags, dropped

# ---- 1. サイト用の集計 ----------------------------------------------------
def summary(beans, tags, min_country=50):
    ids = list(tags)
    cc = Counter(beans[b]["country"] for b in ids if beans[b]["country"])
    countries = sorted([c for c, n in cc.items() if n >= min_country], key=lambda c: -cc[c])
    dims = {
        "origin": (lambda b: beans[b]["country"] if beans[b]["country"] in countries else None, countries),
        "roast": (lambda b: beans[b]["roast"], ["浅", "中", "深"]),
        "process": (lambda b: beans[b]["process"] if beans[b]["process"] in PROCESSES else None, PROCESSES),
    }
    out = {"meta": {"beans": len(ids)}, "dims": {}, "nodes": []}
    for d, (f, levels) in dims.items():
        tot = Counter(f(b) for b in ids if f(b))
        out["dims"][d] = {"levels": levels, "totals": [tot[l] for l in levels]}
    for t in sorted({t for b in ids for t in tags[b]}):
        has = [b for b in ids if t in tags[b]]
        node = {"id": t, "n": len(has)}
        for d, (f, levels) in dims.items():
            c = Counter(f(b) for b in has if f(b))
            node[d] = [c[l] for l in levels]
        out["nodes"].append(node)
    return out

# ---- 2. 焙煎と産地のどちらで決まるか ---------------------------------------
def H(p):
    return -sum(x * math.log2(x) for x in (p, 1 - p) if x > 0)

def cond_mi(sample, y, x, z):
    """I(Y; X | Z)。y は 0/1、x と z はカテゴリ。"""
    groups = defaultdict(list)
    for i in sample:
        groups[z(i)].append(i)
    total = 0.0
    for g in groups.values():
        n = len(g)
        h_y = H(sum(y(i) for i in g) / n)
        h_yx = 0.0
        by_x = defaultdict(list)
        for i in g:
            by_x[x(i)].append(y(i))
        for v in by_x.values():
            h_yx += len(v) / n * H(sum(v) / len(v))
        total += n / len(sample) * (h_y - h_yx)
    return total

def chance(sample, y, x, z, k=20):
    """z の中で x をシャッフルしたときの値の平均（偶然でも出る分）"""
    groups = defaultdict(list)
    for i in sample:
        groups[z(i)].append(i)
    s = 0.0
    for _ in range(k):
        m = {}
        for g in groups.values():
            xs = [x(i) for i in g]
            random.shuffle(xs)
            m.update(zip(g, xs))
        s += cond_mi(sample, y, lambda i: m[i], z)
    return s / k

def roast_origin(beans, tags, min_country=30, min_tag=40, boot=0):
    ids = [b for b in tags if beans[b]["country"] and beans[b]["roast"]]
    cc = Counter(beans[b]["country"] for b in ids)
    ids = [b for b in ids if cc[beans[b]["country"]] >= min_country]
    country = lambda i: beans[i]["country"]
    roast = lambda i: beans[i]["roast"]
    counts = Counter(t for i in ids for t in tags[i])
    rows = []
    for t, n in sorted(counts.items()):
        if n < min_tag:
            continue
        y = lambda i, t=t: t in tags[i]
        h = H(n / len(ids))
        nr, nc = chance(ids, y, roast, country), chance(ids, y, country, roast)
        R = max(cond_mi(ids, y, roast, country) - nr, 0) / h
        C = max(cond_mi(ids, y, country, roast) - nc, 0) / h
        share = R / (R + C) if R + C > 0 else 0.5
        lo = hi = share
        if boot:
            shares = []
            for _ in range(boot):
                s = [random.choice(ids) for _ in ids]
                hs = H(sum(y(i) for i in s) / len(s))
                r_ = max(cond_mi(s, y, roast, country) - nr, 0) / hs
                c_ = max(cond_mi(s, y, country, roast) - nc, 0) / hs
                shares.append(r_ / (r_ + c_) if r_ + c_ > 0 else 0.5)
            shares.sort()
            lo, hi = shares[int(0.05 * (boot - 1))], shares[int(0.95 * (boot - 1))]
        if (R + C) * 100 < 3:
            kind = "どちらでもあまり決まらない"
        elif lo >= 0.5:
            kind = "焙煎"
        elif hi < 0.5:
            kind = "産地"
        else:
            kind = "両方・はっきりしない"
        rp = {r: sum(y(i) for i in ids if roast(i) == r) / max(1, sum(1 for i in ids if roast(i) == r)) for r in "浅中深"}
        rows.append({"tag": t, "n": n, "roast_pct": round(R * 100, 1), "origin_pct": round(C * 100, 1),
                     "roast_share_lo": round(lo, 2), "roast_share_hi": round(hi, 2), "kind": kind,
                     "浅": round(rp["浅"], 3), "中": round(rp["中"], 3), "深": round(rp["深"], 3)})
    return len(ids), rows

# ---- 3. 人の目で確認するサンプル -------------------------------------------
def write_sample(beans, tags, k, path):
    ids = sorted(b for b in tags if beans[b]["raw"].strip())
    random.seed(20261120)
    pick = random.sample(ids, k)
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["bean_id", "roaster", "name", "tasting_notes_raw", "tag", "判定（合っている/置き換え/誤り）", "メモ"])
        for b in pick:
            for t in sorted(x for x in tags[b] if x.startswith("L3:")):
                w.writerow([b, beans[b]["roaster"], beans[b]["name"], beans[b]["raw"], t[3:], "", ""])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--boot", type=int, default=60, help="ブートストラップの回数（0なら計算しない。分類は参考程度になる）")
    ap.add_argument("--sample", type=int, default=0, help="確認用サンプルの豆の件数（0なら書き出さない）")
    a = ap.parse_args()
    random.seed(0)
    os.makedirs(a.out, exist_ok=True)
    beans, tags, dropped = load(a.db)
    print(f"豆 {len(beans)} 件、味タグ付き {len(tags)} 件、補正で外したタグ {dict(dropped)}")
    with open(os.path.join(a.out, "flavor_summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary(beans, tags), f, ensure_ascii=False, separators=(",", ":"))
    n, rows = roast_origin(beans, tags, boot=a.boot)
    with open(os.path.join(a.out, "roast_origin.csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"焙煎/産地の分析：豆 {n} 件")
    for kind in ("焙煎", "産地", "両方・はっきりしない", "どちらでもあまり決まらない"):
        print(f"  {kind}: " + ", ".join(r["tag"][3:] for r in rows if r["tag"].startswith("L3:") and r["kind"] == kind))
    if a.sample:
        write_sample(beans, tags, a.sample, os.path.join(a.out, "tag_check_sample.csv"))
        print(f"確認用サンプル：{a.sample} 件の豆")
    print(f"出力先：{a.out}/")

if __name__ == "__main__":
    main()
