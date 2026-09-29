import pandas as pd
import json
import os
import math

CSV_URL = "https://huggingface.co/datasets/Ichlibitiche/roasterdb-specialty-coffee-sample/raw/main/roasterdb_sample.csv"

# Japanese translations for SCAA Flavor Wheel
TRANSLATIONS = {
    # Categories
    "Floral": "フローラル",
    "Fruity": "フルーティ",
    "Sour/Fermented": "サワー / 発酵",
    "Green/Vegetative": "グリーン / 植物",
    "Other": "その他",
    "Roasted": "ロースト",
    "Spices": "スパイス",
    "Nutty/Cocoa": "ナッツ / ココア",
    "Sweet": "スウィート (甘味)",

    # Subcategories & Descriptors
    "Black Tea": "ブラックティー",
    "Chamomile": "カモミール",
    "Rose": "ローズ",
    "Jasmine": "ジャスミン",
    "Orange Blossom": "オレンジブロッサム",
    "Hibiscus": "ハイビスカス",
    
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

    "Sour": "酸味 (サワー)",
    "Sour Aromatics": "酸のアロマ",
    "Acetic Acid": "酢酸様",
    "Butyric Acid": "酪酸様",
    "Isovaleric Acid": "イソ吉草酸様",
    "Citric Acid": "クエン酸様",
    "Malic Acid": "リンゴ酸様",

    "Alcohol/Fermented": "アルコール / 発酵",
    "Winey": "ワイン様",
    "Whiskey": "ウイスキー様",
    "Fermented": "発酵香",
    "Overripe": "完熟 / 熟しすぎ",

    "Olive Oil": "オリーブオイル",
    "Raw": "生の植物感",
    "Under-ripe": "未熟",
    "Pealike": "えんどう豆様",
    "Fresh": "フレッシュ",
    "Dark Green": "濃いグリーン",
    "Vegetative": "植物感",
    "Hay-like": "干し草様",
    "Herb-like": "ハーブ様",
    "Beany": "豆感",

    "Papery/Musty": "紙 / カビ様",
    "Stale": "古びた香り",
    "Cardboard": "段ボール様",
    "Papery": "紙様",
    "Woody": "ウッディ (木質)",
    "Moldy/Damp": "カビ / 湿気",
    "Musty/Dust": "埃っぽさ",
    "Musty/Earthy": "土っぽさ",
    "Animalic": "アニマリック",
    "Meaty/Brothy": "肉汁様",
    "Phenolic": "フェノール様",

    "Chemical": "薬品様",
    "Bitter": "ビター / 苦味",
    "Salty": "塩味",
    "Medicinal": "薬品臭",
    "Petroleum": "石油様",
    "Skunky": "スカンク臭",
    "Rubber": "ゴム臭",

    "Pipe Tobacco": "パイプタバコ",
    "Tobacco": "タバコ",
    "Burnt": "焦げ感",
    "Acrid": "刺激的な焦げ",
    "Ashy": "灰っぽさ",
    "Smoky": "スモーキー",
    "Brown/Roast": "深煎り香",

    "Cereal": "穀物 (シリアル)",
    "Grain": "穀類",
    "Malt": "モルト (麦芽)",
    "Graham Cracker": "グラハムクラッカー",

    "Pungent": "刺激臭",
    "Pepper": "ペッパー (胡椒)",
    "Brown Spice": "ブラウンスパイス",
    "Anise": "アニス",
    "Nutmeg": "ナツメグ",
    "Cinnamon": "シナモン",
    "Clove": "クローブ",
    "Earl Grey": "アールグレイ",

    "Nutty": "ナッツ",
    "Peanut": "ピーナッツ",
    "Peanuts": "ピーナッツ",
    "Hazelnut": "ヘーゼルナッツ",
    "Almond": "アーモンド",
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
    "Sweet Aromatics": "甘いアロマ"
}

# Color palette mapped to categories and tones
CATEGORY_COLORS = {
    "Floral": {
        "base": "#E05A8D",
        "sub": {
            "Floral": "#EC729C",
            "Black Tea": "#D4497B",
        }
    },
    "Fruity": {
        "base": "#E73845",
        "sub": {
            "Berry": "#D82635",
            "Dried Fruit": "#BF1E2D",
            "Other Fruit": "#F05654",
            "Citrus Fruit": "#F77F48",
        }
    },
    "Sour/Fermented": {
        "base": "#EBB438",
        "sub": {
            "Sour": "#E5A024",
            "Alcohol/Fermented": "#CD901B",
        }
    },
    "Green/Vegetative": {
        "base": "#3C9F40",
        "sub": {
            "Olive Oil": "#66B245",
            "Raw": "#4EA83E",
            "Green/Vegetative": "#368F3B",
            "Beany": "#2B7A30",
        }
    },
    "Other": {
        "base": "#169EAA",
        "sub": {
            "Papery/Musty": "#1BAEBC",
            "Chemical": "#0F8893",
        }
    },
    "Roasted": {
        "base": "#C45525",
        "sub": {
            "Pipe Tobacco": "#B24517",
            "Tobacco": "#9E380D",
            "Burnt": "#8A2E07",
            "Cereal": "#CC6A3A",
        }
    },
    "Spices": {
        "base": "#E6683B",
        "sub": {
            "Pungent": "#F07B4F",
            "Pepper": "#D95526",
            "Brown Spice": "#C74516",
            "Spices": "#E6683B",
        }
    },
    "Nutty/Cocoa": {
        "base": "#975E3D",
        "sub": {
            "Nutty": "#A86D48",
            "Cocoa": "#824B2C",
        }
    },
    "Sweet": {
        "base": "#E89E19",
        "sub": {
            "Brown Sugar": "#D48B0B",
            "Vanilla": "#F2AF30",
            "Honey": "#F7C042",
            "Overall Sweet": "#E09512",
            "Sweet Aromatics": "#CCA81A",
        }
    }
}

def get_node_color(category, subcategory=None, descriptor=None, index=0, total=1):
    cat_cfg = CATEGORY_COLORS.get(category, {"base": "#888888", "sub": {}})
    if not subcategory:
        return cat_cfg["base"]
    
    sub_color = cat_cfg["sub"].get(subcategory, cat_cfg["base"])
    if not descriptor:
        return sub_color
    
    # Slight variation for descriptor
    return sub_color

def main():
    print("Fetching CSV from:", CSV_URL)
    df = pd.read_csv(CSV_URL)
    
    beans = []
    # Track node counts
    node_beans_map = {} # path -> set of bean ids

    for idx, row in df.iterrows():
        b_id = str(row["product_id"])
        
        # parse tasting notes
        raw_notes = str(row["tasting_notes_sca_nodes"]) if pd.notna(row["tasting_notes_sca_nodes"]) else ""
        parsed_notes = []
        if raw_notes:
            note_strings = [s.strip() for s in raw_notes.split(";")]
            for ns in note_strings:
                parts = [p.strip() for p in ns.split(">")]
                if len(parts) >= 1:
                    cat = parts[0]
                    sub = parts[1] if len(parts) >= 2 else parts[0]
                    desc = parts[2] if len(parts) >= 3 else sub
                    full_path = " > ".join(parts)
                    
                    parsed_notes.append({
                        "category": cat,
                        "subcategory": sub,
                        "descriptor": desc,
                        "fullPath": full_path,
                        "pathParts": parts,
                        "nameJa": TRANSLATIONS.get(desc, desc),
                        "catJa": TRANSLATIONS.get(cat, cat),
                        "subJa": TRANSLATIONS.get(sub, sub),
                    })
                    
                    # Record for hierarchy matching
                    p1 = cat
                    p2 = f"{cat} > {sub}"
                    p3 = full_path
                    for p in [p1, p2, p3]:
                        if p not in node_beans_map:
                            node_beans_map[p] = set()
                        node_beans_map[p].add(b_id)

        # parse altitude
        alt_min = row["altitude_min_meters"] if pd.notna(row["altitude_min_meters"]) else None
        alt_max = row["altitude_max_meters"] if pd.notna(row["altitude_max_meters"]) else None
        if alt_min and alt_max:
            altitude_str = f"{int(alt_min)} - {int(alt_max)}m"
        elif alt_min:
            altitude_str = f"{int(alt_min)}m"
        elif alt_max:
            altitude_str = f"{int(alt_max)}m"
        else:
            altitude_str = "標高情報なし"

        bean_item = {
            "id": b_id,
            "title": str(row["title"]) if pd.notna(row["title"]) else "Specialty Coffee",
            "roaster": str(row["source_roaster"]) if pd.notna(row["source_roaster"]) else "Unknown Roaster",
            "country": str(row["origin_country"]) if pd.notna(row["origin_country"]) else "Unknown",
            "region": str(row["origin_region"]) if pd.notna(row["origin_region"]) else None,
            "altitude": altitude_str,
            "altitudeMin": float(alt_min) if alt_min is not None else None,
            "altitudeMax": float(alt_max) if alt_max is not None else None,
            "process": str(row["process_method"]) if pd.notna(row["process_method"]) else "Unknown",
            "roastLevel": str(row["roast_level"]) if pd.notna(row["roast_level"]) else "Unknown",
            "varietals": str(row["varietals"]) if pd.notna(row["varietals"]) else None,
            "weightGrams": int(row["weight_grams"]) if pd.notna(row["weight_grams"]) else 250,
            "priceCurrency": str(row["price_currency"]) if pd.notna(row["price_currency"]) else "USD",
            "priceValue": float(row["price_value"]) if pd.notna(row["price_value"]) else 0.0,
            "tastingNotes": parsed_notes,
            "tastingNotesRaw": raw_notes,
            "confidence": float(row["tasting_notes_confidence"]) if pd.notna(row["tasting_notes_confidence"]) else 0.8,
            "qualityFlag": str(row["quality_flag"]) if pd.notna(row["quality_flag"]) else "good",
            "sourcePlatform": str(row["source_platform"]) if pd.notna(row["source_platform"]) else "",
            "sourceUrl": str(row["source_url"]) if pd.notna(row["source_url"]) else "",
            "retrievedAt": str(row["retrieved_at"]) if pd.notna(row["retrieved_at"]) else ""
        }
        beans.append(bean_item)

    print(f"Processed {len(beans)} coffee beans.")

    # Build the full SCAA hierarchy tree
    # Base structure with all SCAA standard nodes + dataset nodes
    raw_tree = {
        "name": "Coffee Flavors",
        "nameJa": "フレーバー全体",
        "children": []
    }

    # Collect paths from dataset
    category_map = {}

    for bean in beans:
        for note in bean["tastingNotes"]:
            cat = note["category"]
            sub = note["subcategory"]
            desc = note["descriptor"]
            
            if cat not in category_map:
                category_map[cat] = {}
            if sub not in category_map[cat]:
                category_map[cat][sub] = set()
            category_map[cat][sub].add(desc)

    # Convert to hierarchical tree with value = bean count
    for cat_name, sub_dict in category_map.items():
        cat_path = cat_name
        cat_count = len(node_beans_map.get(cat_path, set()))
        cat_node = {
            "name": cat_name,
            "nameJa": TRANSLATIONS.get(cat_name, cat_name),
            "color": CATEGORY_COLORS.get(cat_name, {}).get("base", "#888888"),
            "path": cat_path,
            "level": 1,
            "beanCount": cat_count,
            "children": []
        }
        
        for sub_name, desc_set in sub_dict.items():
            sub_path = f"{cat_name} > {sub_name}"
            sub_count = len(node_beans_map.get(sub_path, set()))
            sub_color = CATEGORY_COLORS.get(cat_name, {}).get("sub", {}).get(sub_name, cat_node["color"])
            
            sub_node = {
                "name": sub_name,
                "nameJa": TRANSLATIONS.get(sub_name, sub_name),
                "color": sub_color,
                "path": sub_path,
                "level": 2,
                "beanCount": sub_count,
                "children": []
            }
            
            for desc_name in sorted(desc_set):
                desc_path = f"{cat_name} > {sub_name} > {desc_name}"
                desc_count = len(node_beans_map.get(desc_path, set()))
                
                desc_node = {
                    "name": desc_name,
                    "nameJa": TRANSLATIONS.get(desc_name, desc_name),
                    "color": sub_color,
                    "path": desc_path,
                    "level": 3,
                    "beanCount": desc_count,
                    "value": max(desc_count, 1)  # leaf size
                }
                sub_node["children"].append(desc_node)
            
            cat_node["children"].append(sub_node)
        
        raw_tree["children"].append(cat_node)

    # Sort categories by size or canonical order
    canonical_order = ["Fruity", "Floral", "Sweet", "Nutty/Cocoa", "Spices", "Roasted", "Sour/Fermented", "Green/Vegetative", "Other"]
    raw_tree["children"].sort(key=lambda x: canonical_order.index(x["name"]) if x["name"] in canonical_order else 99)

    out_beans_path = os.path.join("src", "data", "coffee_beans.json")
    out_tree_path = os.path.join("src", "data", "flavor_wheel_data.json")

    with open(out_beans_path, "w", encoding="utf-8") as f:
        json.dump(beans, f, ensure_ascii=False, indent=2)
    print("Saved:", out_beans_path)

    with open(out_tree_path, "w", encoding="utf-8") as f:
        json.dump(raw_tree, f, ensure_ascii=False, indent=2)
    print("Saved:", out_tree_path)

if __name__ == "__main__":
    main()
