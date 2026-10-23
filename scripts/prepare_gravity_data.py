"""
Prepare gravity network dataset using huggingface dataset
"""
import pandas as pd
import json
import os
import math

DATASET_URL = "hf://datasets/Ichlibitiche/roasterdb-specialty-coffee-sample/roasterdb_sample.csv"

# Category meta definition with vibrant colors and translations
CATEGORY_META = {
    "Fruity": {
        "nameJa": "フルーティ",
        "color": "#FF4D6D",
        "bgGlow": "rgba(255, 77, 109, 0.25)",
        "accent": "#C9184A",
        "description": "ベリー、柑橘、トロピカルフルーツなどの爽やかな果実味",
        "order": 0,
    },
    "Floral": {
        "nameJa": "フローラル",
        "color": "#F72585",
        "bgGlow": "rgba(247, 37, 133, 0.25)",
        "accent": "#B5179E",
        "description": "ジャスミン、ローズ、紅茶のような華やかな香り",
        "order": 1,
    },
    "Sweet": {
        "nameJa": "スウィート (甘味)",
        "color": "#FB8500",
        "bgGlow": "rgba(251, 133, 0, 0.25)",
        "accent": "#D47000",
        "description": "キャラメル、蜂蜜、メープル、バニラなどの芳醇な甘み",
        "order": 2,
    },
    "Nutty/Cocoa": {
        "nameJa": "ナッツ / ココア",
        "color": "#8D5B4C",
        "bgGlow": "rgba(141, 91, 76, 0.25)",
        "accent": "#5E3023",
        "description": "アーモンド、ヘーゼルナッツ、ダークチョコの上品なコク",
        "order": 3,
    },
    "Spices": {
        "nameJa": "スパイス",
        "color": "#E63946",
        "bgGlow": "rgba(230, 57, 70, 0.25)",
        "accent": "#A81825",
        "description": "シナモン、ナツメグ、クローブなどのスパイシーな風味",
        "order": 4,
    },
    "Roasted": {
        "nameJa": "ロースト",
        "color": "#B07D62",
        "bgGlow": "rgba(176, 125, 98, 0.25)",
        "accent": "#7F4F24",
        "description": "トースト、穀物、スモーキーな深みと香ばしさ",
        "order": 5,
    },
    "Green/Vegetative": {
        "nameJa": "グリーン / 植物",
        "color": "#2A9D8F",
        "bgGlow": "rgba(42, 157, 143, 0.25)",
        "accent": "#1D7065",
        "description": "フレッシュハーブやグリーンの爽快なニュアンス",
        "order": 6,
    },
    "Sour/Fermented": {
        "nameJa": "サワー / 発酵",
        "color": "#E9C46A",
        "bgGlow": "rgba(233, 196, 106, 0.25)",
        "accent": "#BA9534",
        "description": "ワインやアップルサイダーのような発酵感と爽快な酸",
        "order": 7,
    },
    "Other": {
        "nameJa": "その他",
        "color": "#64748B",
        "bgGlow": "rgba(100, 116, 139, 0.25)",
        "accent": "#475569",
        "description": "その他の独特なアロマと特徴",
        "order": 8,
    }
}

# Japanese translations for descriptors
TRANSLATIONS = {
    "Floral": "フローラル",
    "Fruity": "フルーティ",
    "Sour/Fermented": "サワー / 発酵",
    "Green/Vegetative": "グリーン / 植物",
    "Other": "その他",
    "Roasted": "ロースト",
    "Spices": "スパイス",
    "Nutty/Cocoa": "ナッツ / ココア",
    "Sweet": "スウィート (甘味)",
    "Black Tea": "ブラックティー",
    "Chamomile": "カモミール",
    "Rose": "ローズ",
    "Jasmine": "ジャスミン",
    "Berry": "ベリー",
    "Blackberry": "ブラックベリー",
    "Raspberry": "ラズベリー",
    "Blueberry": "ブルーベリー",
    "Strawberry": "ストロベリー",
    "Dried Fruit": "ドライフルーツ",
    "Raisin": "レーズン",
    "Prune": "プルーン",
    "Other Fruit": "その他の果実",
    "Coconut": "ココナッツ",
    "Cherry": "チェリー",
    "Pomegranate": "ザクロ",
    "Pineapple": "パイナップル",
    "Grape": "ぶどう (グレープ)",
    "Apple": "りんご (アップル)",
    "Peach": "桃 (ピーチ)",
    "Pear": "洋梨 (ペア)",
    "Mango": "マンゴー",
    "Passion Fruit": "パッションフルーツ",
    "Tropical Fruit": "トロピカルフルーツ",
    "Citrus Fruit": "柑橘類 (シトラス)",
    "Grapefruit": "グレープフルーツ",
    "Orange": "オレンジ",
    "Lemon": "レモン",
    "Lime": "ライム",
    "Tangerine": "タンジェリン",
    "Bergamot": "ベルガモット",
    "Nutty": "ナッツ",
    "Almond": "アーモンド",
    "Hazelnut": "ヘーゼルナッツ",
    "Peanut": "ピーナッツ",
    "Pecan": "ペカンナッツ",
    "Cocoa": "ココア / チョコ",
    "Chocolate": "チョコレート",
    "Dark Chocolate": "ダークチョコレート",
    "Milk Chocolate": "ミルクチョコレート",
    "Cocoa Nibs": "カカオニブ",
    "Brown Sugar": "黒糖・ブラウンシュガー",
    "Molasses": "糖蜜 (モラセス)",
    "Maple Syrup": "メープルシロップ",
    "Caramelized": "キャラメライズ",
    "Caramel": "キャラメル",
    "Honey": "ハニー (蜂蜜)",
    "Vanilla": "バニラ",
    "Overall Sweet": "総合的な甘味",
    "Cinnamon": "シナモン",
    "Nutmeg": "ナツメグ",
    "Clove": "クローブ",
    "Anise": "アニス",
    "Brown Spice": "ブラウンスパイス",
    "Pepper": "ペッパー (胡椒)",
    "Cereal": "穀物 (シリアル)",
    "Tobacco": "タバコ",
    "Burnt": "焦げ感"
}

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hex(rgb):
    return '#{:02x}{:02x}{:02x}'.format(
        max(0, min(255, int(round(rgb[0])))),
        max(0, min(255, int(round(rgb[1])))),
        max(0, min(255, int(round(rgb[2]))))
    )

def blend_colors(category_weights):
    if not category_weights:
        return "#8D5B4C"
    r_total, g_total, b_total = 0.0, 0.0, 0.0
    for cat, weight in category_weights.items():
        meta = CATEGORY_META.get(cat, {"color": "#8D5B4C"})
        rgb = hex_to_rgb(meta["color"])
        r_total += rgb[0] * weight
        g_total += rgb[1] * weight
        b_total += rgb[2] * weight
    return rgb_to_hex((r_total, g_total, b_total))

def main():
    print(f"Reading dataset via pandas from: {DATASET_URL}")
    df = pd.read_csv(DATASET_URL)
    print(f"Successfully loaded {len(df)} records.")

    beans = []
    category_bean_count = {}
    links = []

    for idx, row in df.iterrows():
        bean_id = str(row["product_id"])
        raw_notes = str(row["tasting_notes_sca_nodes"]) if pd.notna(row["tasting_notes_sca_nodes"]) else ""
        paths = [p.strip() for p in raw_notes.split(';') if p.strip()]

        tasting_notes = []
        cat_counts = {}
        for p in paths:
            parts = [part.strip() for part in p.split('>')]
            cat = parts[0] if len(parts) > 0 else "Other"
            sub = parts[1] if len(parts) > 1 else cat
            desc = parts[2] if len(parts) > 2 else sub

            cat_counts[cat] = cat_counts.get(cat, 0) + 1
            tasting_notes.append({
                "category": cat,
                "subcategory": sub,
                "descriptor": desc,
                "fullPath": p,
                "nameJa": TRANSLATIONS.get(desc, desc),
                "catJa": TRANSLATIONS.get(cat, cat),
                "subJa": TRANSLATIONS.get(sub, sub)
            })

        total_tag_count = sum(cat_counts.values()) or 1
        cat_weights = {c: count / total_tag_count for c, count in cat_counts.items()}
        categories = sorted(list(cat_counts.keys()))

        for c in categories:
            category_bean_count[c] = category_bean_count.get(c, 0) + 1

        # Calculate blended color
        blended_color = blend_colors(cat_weights)

        # Altitude
        alt_min = float(row["altitude_min_meters"]) if pd.notna(row["altitude_min_meters"]) else None
        alt_max = float(row["altitude_max_meters"]) if pd.notna(row["altitude_max_meters"]) else None
        alt_str = "不明"
        if alt_min and alt_max:
            if alt_min == alt_max:
                alt_str = f"{int(alt_min)}m"
            else:
                alt_str = f"{int(alt_min)} - {int(alt_max)}m"
        elif alt_min:
            alt_str = f"{int(alt_min)}m〜"

        bean_obj = {
            "id": bean_id,
            "title": str(row["title"]),
            "roaster": str(row["source_roaster"]),
            "country": str(row["origin_country"]) if pd.notna(row["origin_country"]) else "不明",
            "region": str(row["origin_region"]) if pd.notna(row["origin_region"]) else None,
            "altitude": alt_str,
            "altitudeMin": alt_min,
            "altitudeMax": alt_max,
            "process": str(row["process_method"]) if pd.notna(row["process_method"]) else "不明",
            "roastLevel": str(row["roast_level"]) if pd.notna(row["roast_level"]) else "Medium",
            "varietals": str(row["varietals"]) if pd.notna(row["varietals"]) else None,
            "weightGrams": int(row["weight_grams"]) if pd.notna(row["weight_grams"]) else None,
            "priceCurrency": str(row["price_currency"]) if pd.notna(row["price_currency"]) else "USD",
            "priceValue": float(row["price_value"]) if pd.notna(row["price_value"]) else None,
            "sourceUrl": str(row["source_url"]) if pd.notna(row["source_url"]) else None,
            "categories": categories,
            "categoryCounts": cat_counts,
            "categoryWeights": cat_weights,
            "primaryCategory": max(cat_counts.items(), key=lambda x: x[1])[0] if cat_counts else "Other",
            "isMultiLabel": len(categories) > 1,
            "labelCount": len(categories),
            "tagCount": len(tasting_notes),
            "blendColor": blended_color,
            "tastingNotes": tasting_notes,
            "tastingNotesRaw": raw_notes,
            "confidence": float(row["tasting_notes_confidence"]) if pd.notna(row["tasting_notes_confidence"]) else 1.0,
            "qualityFlag": str(row["quality_flag"]) if pd.notna(row["quality_flag"]) else "good"
        }
        beans.append(bean_obj)

        # Create gravity links from bean to anchor category
        for cat, count in cat_counts.items():
            weight = cat_weights[cat]
            links.append({
                "source": bean_id,
                "target": cat,
                "weight": weight,
                "count": count
            })

    # Prepare Anchor Nodes
    anchors = []
    # Sort categories by defined order or frequency
    sorted_cats = sorted(category_bean_count.keys(), key=lambda c: CATEGORY_META.get(c, {}).get("order", 99))
    
    for i, cat in enumerate(sorted_cats):
        meta = CATEGORY_META.get(cat, {
            "nameJa": cat,
            "color": "#888888",
            "bgGlow": "rgba(136, 136, 136, 0.25)",
            "accent": "#555555",
            "description": ""
        })
        anchors.append({
            "id": cat,
            "name": cat,
            "nameJa": meta["nameJa"],
            "color": meta["color"],
            "accent": meta["accent"],
            "bgGlow": meta["bgGlow"],
            "description": meta["description"],
            "beanCount": category_bean_count[cat],
            "isAnchor": True,
            "order": i
        })

    output_data = {
        "metadata": {
            "source": DATASET_URL,
            "totalBeans": len(beans),
            "totalAnchors": len(anchors),
            "singleLabelCount": sum(1 for b in beans if not b["isMultiLabel"]),
            "multiLabelCount": sum(1 for b in beans if b["isMultiLabel"]),
        },
        "anchors": anchors,
        "beans": beans,
        "links": links
    }

    output_path = "src/data/gravity_network_data.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"Saved gravity network data to: {output_path}")
    print(f"Anchors: {len(anchors)}")
    print(f"Beans: {len(beans)}")
    print(f"Links: {len(links)}")

if __name__ == "__main__":
    main()
