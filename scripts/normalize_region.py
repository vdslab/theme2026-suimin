#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Region 正規化スクリプト。

data/merged_data_cleaned.csv の自由記述 `Region` を、産地・地域ごとの味比較に
使える統制列へ変換する。元列は保持し、以下の列を追加する:

    Region_clean   : 表記統一した主産地名（小文字/ノイズ除去/複合分割後）
    Region_admin1  : 第1次コーヒー生産地域（国により 県/州/産地region）= 味比較の主軸
    Region_admin2  : 市町村レベル（取れる範囲、無ければ空）
    Region_source  : token(地域名一致) / manual(知識で推定) / unmatched

副産物:
    data/region_mapping.csv  : raw -> clean/admin1/admin2/source のレビュー用マッピング

使い方:
    python3 scripts/normalize_region.py           # レポートのみ（dry-run）
    python3 scripts/normalize_region.py --write    # CSVに列追加して書き戻す
"""
import argparse
import csv
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT_CSV = ROOT / "data" / "merged_data_cleaned.csv"
MAPPING_CSV = ROOT / "data" / "region_mapping.csv"

NEW_COLS = ["Region_clean", "Region_admin1", "Region_admin2", "Region_source"]

# ---------------------------------------------------------------------------
# 前処理ヘルパ
# ---------------------------------------------------------------------------

_NA = {"", "na", "nan", "none", "null"}


def is_blank(v):
    return v is None or v.strip().lower() in _NA


def fold(s):
    """アクセント除去 + 小文字化 + 空白正規化。マッチ用キー。"""
    if s is None:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().strip()
    s = re.sub(r"\s+", " ", s)
    return s


# 明らかなノイズ/ゴミデータ（産地情報でない）
GARBAGE = {"test", "mmm", "blend", "asia pacific", "central america"}

# 表示用に落とすグレード/修飾語
DROP_TOKENS = {"supremo", "region", "province", "prefecture", "department",
               "township", "village", "dist.", "dist", "district", "county",
               "city", "estate", "station", "br"}


def clean_display(raw):
    """自由記述から表示用のクリーン文字列を作る（複合分割前の全体整形）。"""
    s = unicodedata.normalize("NFKC", raw).strip()
    # 括弧内の座標/コード等ノイズを除去
    s = re.sub(r"\([^)]*\)", " ", s)
    # CJK文字（漢字・かな）と全角記号を除去（Taiwan等の中国語併記対策）
    s = re.sub(r"[　-〿㐀-鿿豈-﫿＀-￯]", " ", s)
    # 末尾の番地（例: 60號）由来の残り数字を除去
    s = re.sub(r"\b\d+\s*$", " ", s)
    # 「exact location:」以降のような文章ノイズを除去
    s = re.sub(r"\bexact location.*$", " ", s, flags=re.I)
    s = re.sub(r"\bat a place called.*$", " ", s, flags=re.I)
    s = re.sub(r"\bcode\s*\d+.*$", " ", s, flags=re.I)
    # 先頭の数字ラベル（例: "52 narino"）を除去
    s = re.sub(r"^\s*\d+\s+", "", s)
    s = re.sub(r"\s+", " ", s).strip(" ,;/-")
    return s


# ---------------------------------------------------------------------------
# 国別マッピング
#   ADMIN1_CANON[country] : fold済みトークン -> admin1 の正式表示名
#   OVERRIDE[country]     : fold済み clean全体 -> (admin1, admin2)  ※知識で推定
# admin1 の意味は国により「県/州/コーヒー産地region」。レポート参照。
# ---------------------------------------------------------------------------

# 第1次コーヒー地域の正規名（fold(token) -> 正式表示）
ADMIN1_CANON = {
    "Mexico": {
        "veracruz": "Veracruz", "chiapas": "Chiapas", "oaxaca": "Oaxaca",
        "hidalgo": "Hidalgo", "guerrero": "Guerrero", "jalisco": "Jalisco",
        "colima": "Colima", "nayarit": "Nayarit", "puebla": "Puebla",
    },
    "Colombia": {
        "huila": "Huila", "cauca": "Cauca", "santander": "Santander",
        "cundinamarca": "Cundinamarca", "narino": "Nariño", "tolima": "Tolima",
        "antioquia": "Antioquia", "risaralda": "Risaralda", "boyaca": "Boyacá",
    },
    "Guatemala": {
        "oriente": "Oriente", "nuevo oriente": "Nuevo Oriente",
        "huehuetenango": "Huehuetenango", "antigua": "Antigua",
        "san marcos": "San Marcos", "santa rosa": "Santa Rosa",
        "jalapa": "Jalapa", "atitlan": "Atitlán", "acatenango": "Acatenango",
        "norte": "Norte", "occidente": "Occidente", "quiche": "Quiché",
        "quetzaltenango": "Quetzaltenango", "el progreso": "El Progreso",
        "guatemala": "Guatemala",
    },
    "Brazil": {
        "sul de minas": "Sul de Minas", "cerrado": "Cerrado Mineiro",
        "mantiqueira de minas": "Mantiqueira de Minas",
        "matas de minas": "Matas de Minas", "mogiana": "Mogiana",
        "minas gerais": "Minas Gerais",
    },
    "Costa Rica": {
        "tarrazu": "Tarrazú", "central valley": "Central Valley",
        "west valley": "West Valley", "tres rios": "Tres Ríos",
        "turrialba": "Turrialba", "brunca": "Brunca",
    },
    "Ethiopia": {
        "sidamo": "Sidamo", "yirgacheffe": "Yirgacheffe", "oromia": "Oromia",
        "oromiya": "Oromia", "limu": "Limu", "guji": "Guji", "kaffa": "Kaffa",
        "welega": "Welega",
    },
    "Honduras": {
        "comayagua": "Comayagua", "intibuca": "Intibucá",
        "ocotepeque": "Ocotepeque", "el paraiso": "El Paraíso",
    },
    "Kenya": {
        "nyeri": "Nyeri", "kiambu": "Kiambu", "muranga": "Murang'a",
        "kirinyaga": "Kirinyaga", "meru": "Meru",
    },
    "Nicaragua": {
        "jinotega": "Jinotega", "matagalpa": "Matagalpa",
        "nueva segovia": "Nueva Segovia",
    },
    "China": {"yunnan": "Yunnan"},
    "Taiwan": {
        "tainan": "Tainan", "nantou": "Nantou", "taichung": "Taichung",
        "changhua": "Changhua", "chiayi": "Chiayi", "yunlin": "Yunlin",
        "miaoli": "Miaoli", "taitung": "Taitung", "pingtung": "Pingtung",
        "new taipei": "New Taipei",
    },
}

# 市町村/村/表記ゆれ -> (admin1, admin2)。admin2 が None のときは admin1 のみ。
# 地理知識に基づく推定（source=manual）。
OVERRIDE = {
    "Mexico": {
        "coatepec": ("Veracruz", "Coatepec"),
        "coatepec, coatepec": ("Veracruz", "Coatepec"),
        "xalapa": ("Veracruz", "Xalapa"),
        "fortin de las flores": ("Veracruz", "Fortín de las Flores"),
        "zentla": ("Veracruz", "Zentla"),
        "totutla": ("Veracruz", "Totutla"),
        "altotonga": ("Veracruz", "Altotonga"),
        "coscomatepec": ("Veracruz", "Coscomatepec"),
        "ixhuatlan del cafe": ("Veracruz", "Ixhuatlán del Café"),
        "chocaman, veracruz": ("Veracruz", "Chocamán"),
        "hustusco": ("Veracruz", "Huatusco"),
        "mahuixtlan": ("Veracruz", "Mahuixtlán"),
        "juchique de ferrer": ("Veracruz", "Juchique de Ferrer"),
        "yecuatla": ("Veracruz", "Yecuatla"),
        "ohuapan, tlaltetela": ("Veracruz", "Tlaltetela"),
        "cordoba": ("Veracruz", "Córdoba"),
        "progreso santa rosa teocelo": ("Veracruz", "Teocelo"),
        "tepetzingo": ("Veracruz", "Tepetzingo"),
        "la concordia": ("Chiapas", "La Concordia"),
        "la concordia, chiapas": ("Chiapas", "La Concordia"),
        "tapachula": ("Chiapas", "Tapachula"),
        "motozintla": ("Chiapas", "Motozintla"),
        "motozintla, chiapas": ("Chiapas", "Motozintla"),
        "jaltenango": ("Chiapas", "Jaltenango"),
        "chiapas, jaltenango": ("Chiapas", "Jaltenango"),
        "yajalon": ("Chiapas", "Yajalón"),
        "sierra norte yajalon, chiapas": ("Chiapas", "Yajalón"),
        "ocosingo": ("Chiapas", "Ocosingo"),
        "chilon": ("Chiapas", "Chilón"),
        "sacun palma, municipio de chilon, chiapas": ("Chiapas", "Chilón"),
        "amatenango de la frontera": ("Chiapas", "Amatenango de la Frontera"),
        "siltepec el triunfo": ("Chiapas", "Siltepec"),
        "siltepec el triunfo, chiapas, mexico": ("Chiapas", "Siltepec"),
        "tuxtla gutierrez": ("Chiapas", "Tuxtla Gutiérrez"),
        "san pedro cotzilnam": ("Chiapas", "San Pedro Cotzilnam"),
        "sierra fraylesca, chiapas": ("Chiapas", "Fraylesca"),
        "sierra, chiapas": ("Chiapas", None),
        "escuitla": ("Chiapas", "Escuintla"),
        "zaragoza itundujia": ("Oaxaca", "Santiago Itundujia"),
        "santa catarina juquila": ("Oaxaca", "Santa Catarina Juquila"),
        "juquila": ("Oaxaca", "Juquila"),
        "pluma hidalogo, oaxaca": ("Oaxaca", "Pluma Hidalgo"),
        "pochutla": ("Oaxaca", "San Pedro Pochutla"),
        "santa maria sitepec": ("Oaxaca", "Santa María Sitepec"),
        "santo reyes nopala": ("Oaxaca", "Santos Reyes Nopala"),
        "santo domingo cacalotepec": ("Oaxaca", "Santo Domingo Cacalotepec"),
        "san miguel del puerto": ("Oaxaca", "San Miguel del Puerto"),
        "huautla de jimenez": ("Oaxaca", "Huautla de Jiménez"),
        "xochitonalco, huautla": ("Oaxaca", "Huautla"),
        "villa talea de castro": ("Oaxaca", "Villa Talea de Castro"),
        "sierra alta mixe y zapoteca": ("Oaxaca", None),
        "san bartolo tutotepec": ("Hidalgo", "San Bartolo Tutotepec"),
        "huazalingo, hidalgo": ("Hidalgo", "Huazalingo"),
        "calnali, hidalgo": ("Hidalgo", "Calnali"),
        "tenango de doria, hidalgo": ("Hidalgo", "Tenango de Doria"),
        "tlanchinol, hidalgo": ("Hidalgo", "Tlanchinol"),
        "chapulhuacan, hidalgo": ("Hidalgo", "Chapulhuacán"),
        "jaltocan, hidalgo": ("Hidalgo", "Jaltocán"),
        "zapotitlan de mendez": ("Puebla", "Zapotitlán de Méndez"),
        "xicotepec de juarez": ("Puebla", "Xicotepec de Juárez"),
        "tlatlauquitepec": ("Puebla", "Tlatlauquitepec"),
        "tlacuilotepec": ("Puebla", "Tlacuilotepec"),
        "atoyac de alvarez": ("Guerrero", "Atoyac de Álvarez"),
        "petatlan": ("Guerrero", "Petatlán"),
        "zihuatanejo de azueta": ("Guerrero", "Zihuatanejo"),
        "iliatenco, guerrero": ("Guerrero", "Iliatenco"),
        "talpa de allende": ("Jalisco", "Talpa de Allende"),
        "el desmoronado, talpan de allende jalisco": ("Jalisco", "Talpa de Allende"),
        "cofradia de suchitlan": ("Colima", "Cofradía de Suchitlán"),
        "manzanillo": ("Colima", "Manzanillo"),
    },
    "Colombia": {
        "pitalito": ("Huila", "Pitalito"),
        "la plata": ("Huila", "La Plata"),
        "south huila": ("Huila", None),
        "huila supremo": ("Huila", None),
        "guayata": ("Boyacá", "Guayatá"),
        "pasto": ("Nariño", "Pasto"),
        "52 narino (exact location: mattituy; municipal region: florida code 381":
            ("Nariño", "Florida"),
        "pereira": ("Risaralda", "Pereira"),
    },
    "Guatemala": {
        "orient": ("Oriente", None),
        "chuva, san marcos": ("San Marcos", "Chuva"),
        "el tumbador, san marcos": ("San Marcos", "El Tumbador"),
        "la reforma, san marcos": ("San Marcos", "La Reforma"),
        "sacatepequez, guatemala": ("Antigua", "Sacatepéquez"),
        "san lucas toliman, solola": ("Atitlán", "San Lucas Tolimán"),
        "solola": ("Atitlán", "Sololá"),
        "aldea xeucalvitz, ixil region, quiche department": ("Quiché", "Ixil"),
    },
    "Brazil": {
        "south of minas": ("Sul de Minas", None),
        "sul de minas": ("Sul de Minas", None),
        "sul de minas - carmo de minas": ("Sul de Minas", "Carmo de Minas"),
        "minas gerais, br": ("Minas Gerais", None),
        "mountains of minas gerais": ("Minas Gerais", None),
        "monte carmelo": ("Cerrado Mineiro", "Monte Carmelo"),
        "campos altos - cerrado": ("Cerrado Mineiro", "Campos Altos"),
        "cerrado - monte carmelo - minas gerais": ("Cerrado Mineiro", "Monte Carmelo"),
        "chapadao de ferro (cerrado mineiro)": ("Cerrado Mineiro", "Chapadão de Ferro"),
        "grama valley": ("Mantiqueira de Minas", "Vale da Grama"),
        "vale da grama": ("Mantiqueira de Minas", "Vale da Grama"),
        "carmo de minas": ("Mantiqueira de Minas", "Carmo de Minas"),
        "brazil matas de minas": ("Matas de Minas", None),
        "high mogiana": ("Mogiana", None),
        "alta paulista (sao paulo)": ("São Paulo", "Alta Paulista"),
    },
    "Taiwan": {
        "dongshan dist., tainan city": ("Tainan", "Dongshan"),
        "nanxi dist., tainan city": ("Tainan", "Nanxi"),
        "baihe dist., tainan city": ("Tainan", "Baihe"),
        "natou county": ("Nantou", None),
        "nantou": ("Nantou", None),
        "guoshing township": ("Nantou", "Guoshing"),
        "taichung xinshe": ("Taichung", "Xinshe"),
        "taichung taiping": ("Taichung", "Taiping"),
        "changhua baguashan": ("Changhua", "Baguashan"),
        "leye, alishan township, chiayi county": ("Chiayi", "Alishan"),
        "chiayi alishan": ("Chiayi", "Alishan"),
        "chiayi fanlu": ("Chiayi", "Fanlu"),
        "mountain ali, taiwan": ("Chiayi", "Alishan"),
        "yunlin": ("Yunlin", None),
        "yunlin gukeng he bao": ("Yunlin", "Gukeng"),
        "new taipei zhonghe": ("New Taipei", "Zhonghe"),
        "taiwu township , pingtung county": ("Pingtung", "Taiwu"),
        # CJKのみ表記（clean後に空になるため原文foldキーで対応）
        "南投國姓": ("Nantou", "Guoshing"),
        "古坑鄉荷包村尖山坑60號": ("Yunlin", "Gukeng"),
        "台中和平區": ("Taichung", "Heping"),
        "台中新社": ("Taichung", "Xinshe"),
        "台東太麻里": ("Taitung", "Taimali"),
        "嘉義阿里山": ("Chiayi", "Alishan"),
        "苗栗三灣": ("Miaoli", "Sanwan"),
        "苗栗泰安": ("Miaoli", "Taian"),
        "國姓鄉 guoshing township": ("Nantou", "Guoshing"),
        "台南市東山區 (dongshan dist., tainan city)": ("Tainan", "Dongshan"),
        "台南市東山區( dongshan dist., tainan city)": ("Tainan", "Dongshan"),
    },
    "United States (Hawaii)": {
        "kona": ("Kona", None),
    },
    "Honduras": {
        "marcala": ("La Paz", "Marcala"),
        "comayagua, honduras": ("Comayagua", None),
        "siguatepeque, comayagua": ("Comayagua", "Siguatepeque"),
        "guinope el paraiso": ("El Paraíso", "Güinope"),
        "central region": ("Central Region", None),
        "occidental": ("Western Region", None),
        "western region": ("Western Region", None),
    },
    "Costa Rica": {
        "valle central": ("Central Valley", None),
        "west and central valley": ("West Valley", None),
        "occidental": ("West Valley", None),
        "san ramon": ("West Valley", "San Ramón"),
        "naranjo": ("West Valley", "Naranjo"),
    },
    "Ethiopia": {
        "ethiopia, sidamo": ("Sidamo", None),
        "aricha": ("Yirgacheffe", "Aricha"),
        "gedio": ("Yirgacheffe", "Gedeo"),
        "guji-hambela": ("Guji", "Hambela"),
        "blida,kercha,guji,oromia": ("Guji", "Kercha"),
        "kelem welega": ("Welega", "Kelem"),
        "snnp/kaffa zone,gimbowereda": ("Kaffa", "Gimbo"),
        "kefa zone, gimbo distict, at a place called woka araba, south west ethiopia.":
            ("Kaffa", "Gimbo"),
        "snnprg; kafa; telo woreda; shada kebele": ("Kaffa", "Telo"),
    },
    "Tanzania, United Republic Of": {
        "arusha meru": ("Arusha", "Meru"),
        "karatu arusha": ("Arusha", "Karatu"),
        "karatu": ("Arusha", "Karatu"),
        "karatu northern": ("Arusha", "Karatu"),
        "karatu ngorogoro": ("Arusha", "Karatu"),
        "manyara, karatu": ("Arusha", "Karatu"),
        "ngorogoro": ("Arusha", "Ngorongoro"),
        "oldeani , mongola": ("Arusha", "Oldeani"),
        "meru": ("Arusha", "Meru"),
        "nkure- meru": ("Arusha", "Meru"),
        "mbeya": ("Mbeya", None),
        "ilomba vilage, mbozi": ("Mbeya", "Mbozi"),
        "iwala village, mbeya rural": ("Mbeya", "Mbeya Rural"),
        "mbinga": ("Ruvuma", "Mbinga"),
        "ruvuma, mbinga": ("Ruvuma", "Mbinga"),
        "ruvuma": ("Ruvuma", None),
        "moshi": ("Kilimanjaro", "Moshi"),
        "mkuu rombo": ("Kilimanjaro", "Rombo"),
        "arusha": ("Arusha", None),
        "kilimanjaro": ("Kilimanjaro", None),
    },
    "Uganda": {
        "eastern": ("Eastern", None),
        "eastern uganda": ("Eastern", None),
        "iganga namadrope eastern": ("Eastern", "Iganga"),
        "bulambuli eastern region": ("Eastern", "Bulambuli"),
        "kapchorwa eastern": ("Eastern", "Kapchorwa"),
        "kapchorwa": ("Eastern", "Kapchorwa"),
        "mbale": ("Eastern", "Mbale"),
        "mt elgon": ("Eastern", "Mt. Elgon"),
        "sipi, mt elgon": ("Eastern", "Sipi"),
        "western": ("Western", None),
        "sheema south western": ("Western", "Sheema"),
        "south western": ("Western", None),
        "kasese": ("Western", "Kasese"),
        "kasese, mt. rwenzori": ("Western", "Kasese"),
        "mt. rwenzori": ("Western", "Mt. Rwenzori"),
        "central": ("Central", None),
        "luwero central region": ("Central", "Luwero"),
        "west nile": ("West Nile", None),
        "southern": ("Southern", None),
    },
    "Thailand": {
        "chiangrai": ("Chiang Rai", None),
        "chiang rai": ("Chiang Rai", None),
        "chiang rai thailand": ("Chiang Rai", None),
        "doi chaang village, chiang rai, thialand": ("Chiang Rai", "Doi Chaang"),
        "phahi": ("Chiang Rai", "Pha Hi"),
    },
    "Nicaragua": {
        "jalapa": ("Nueva Segovia", "Jalapa"),
        "dipilto, nueva segovia": ("Nueva Segovia", "Dipilto"),
    },
    "Kenya": {
        "central kenya": ("Central", None),
        "muranga": ("Murang'a", None),
        "meru county": ("Meru", None),
    },
    "El Salvador": {
        "apaneca": ("Apaneca-Ilamatepec", None),
        "ataco, apaneca - ilamatepec mountain range": ("Apaneca-Ilamatepec", "Ataco"),
        "department of ahuachapan, municipality of apanecallamatepec mountain":
            ("Apaneca-Ilamatepec", "Apaneca"),
        "santa ana": ("Santa Ana", None),
        "el balsamo, quezaltepec": ("El Bálsamo-Quezaltepeque", None),
        "cacahuatique": ("Cacahuatique", None),
    },
    "Indonesia": {
        "sumatra brastagi": ("North Sumatra", "Berastagi"),
        "bener meriah": ("Aceh", "Bener Meriah"),
        "aceh tengah": ("Aceh", "Central Aceh"),
        "aceh": ("Aceh", None),
        "aceh gayo": ("Aceh", "Gayo"),
        "bali": ("Bali", None),
        "ijen": ("East Java", "Ijen"),
        "bondowoso": ("East Java", "Bondowoso"),
        "east java": ("East Java", None),
        "sulawesi": ("Sulawesi", None),
        "sapan toraja": ("Sulawesi", "Toraja"),
        "lintong": ("North Sumatra", "Lintong"),
        "dolok sanggul": ("North Sumatra", "Dolok Sanggul"),
        "lington nihuta": ("North Sumatra", "Lintong Nihuta"),
        "temanggung, indonesia": ("Central Java", "Temanggung"),
    },
    "China": {
        "dehong prefecture": ("Yunnan", "Dehong"),
        "menglian": ("Yunnan", "Menglian"),
        "xishuangbanna prefecture": ("Yunnan", "Xishuangbanna"),
    },
    "India": {
        "chikmagalur": ("Karnataka", "Chikmagalur"),
        "chikmagalur karnataka": ("Karnataka", "Chikmagalur"),
        "chickmangalore": ("Karnataka", "Chikmagalur"),
        "chikmagalur karnataka indua": ("Karnataka", "Chikmagalur"),
        "chikmagalur karnataka india": ("Karnataka", "Chikmagalur"),
    },
    "Malawi": {
        "mzuzu": ("Northern", "Mzuzu"),
        "southern- zomba": ("Southern", "Zomba"),
        "kakoma": ("Northern", "Kakoma"),
    },
    "Peru": {
        "san ignacio": ("Cajamarca", "San Ignacio"),
        "cajamarca": ("Cajamarca", None),
        "penachi, cecanor": ("Lambayeque", "Penachi"),
        "puno": ("Puno", None),
        "huanuco": ("Huánuco", None),
    },
    "Vietnam": {
        "dala": ("Lâm Đồng", "Đà Lạt"),
        "vietnam cau dat": ("Lâm Đồng", "Cầu Đất"),
        "don duong": ("Lâm Đồng", "Đơn Dương"),
        "vietnam tutra": ("Lâm Đồng", "Tu Tra"),
    },
    "Myanmar": {
        "ywar ngan": ("Shan", "Ywangan"),
        "ywar ngan township": ("Shan", "Ywangan"),
        "yauk sauk, shan state": ("Shan", "Yauk Sauk"),
        "pyinoolwin": ("Mandalay", "Pyin Oo Lwin"),
        "pyin oo lwin": ("Mandalay", "Pyin Oo Lwin"),
        "doe kwin, pyin oo lwin": ("Mandalay", "Pyin Oo Lwin"),
    },
    "Haiti": {
        "dondon, haiti": ("Nord", "Dondon"),
        "thiotte, haiti": ("Sud-Est", "Thiotte"),
        "marmelade": ("Artibonite", "Marmelade"),
        "department d'artibonite , haiti": ("Artibonite", None),
    },
    "Philippines": {
        "bukidnon, mindanao, philppines": ("Northern Mindanao", "Bukidnon"),
        "davao city, region 11": ("Davao", "Davao City"),
        "benguet, mountain province": ("Cordillera", "Benguet"),
        "corillera administrative": ("Cordillera", None),
    },
    "Panama": {"boquete": ("Chiriquí", "Boquete")},
    "United States (Puerto Rico)": {"yauco region": ("Yauco", None)},
    "Ecuador": {"province of manabi, ecuador": ("Manabí", None)},
    "Laos": {"paksong,laos": ("Champasak", "Paksong")},
    "Burundi": {"kayanza": ("Kayanza", None), "mumirwa": ("Mumirwa", None)},
    "Papua New Guinea": {"eastern highlands province": ("Eastern Highlands", None)},
    "Japan": {"ada okinawa japan": ("Okinawa", "Ada")},
    "Rwanda": {"gicumbi": ("Northern", "Gicumbi")},
    "Zambia": {"mubuyu estate": ("Southern", "Mubuyu")},
    "Mauritius": {"chamarel (south west)": ("Rivière Noire", "Chamarel")},
}

# admin1 が確定できない/産地情報でない値（国のみ・macro・データ誤り等）
UNMATCHED_HINTS = {
    "mexico", "taiwan", "台灣", "costa rica", "guatemala", "kenya", "peru",
    "vietnam", "haiti", "indonesia", "thailand", "addis ababa", "eje cafetero",
    "sierra madre occidental", "menglian",  # ← Mexico欄のmenglianは中国地名、誤記
    "lao p.d.r.", "cnra station of divo", "san rafael", "san juan, playas",
    "cuarenteño", "la yerba", "la yerbabuena", "tepictla", "temaxcalapa",
    "el remudadero", "san isidro", "la cumbre", "canoas", "los angeles",
    "adolfo lopez mateos", "fln mirador", "nayarit", "colima",
    "shizingo village", "ikand village", "northern",
}


def normalize(country, raw):
    """1件の Region を正規化。 (clean, admin1, admin2, source) を返す。"""
    if is_blank(raw):
        return ("", "", "", "unmatched")

    disp = clean_display(raw)
    key = fold(disp)
    raw_key = fold(raw)

    if key in GARBAGE or raw_key in GARBAGE:
        return (disp, "", "", "unmatched")

    over = OVERRIDE.get(country, {})
    # 1) オーバーライド（原文キー優先、次に整形後キー）
    for k in (raw_key, key):
        if k in over:
            a1, a2 = over[k]
            return (disp, a1, a2 or "", "manual")

    canon = ADMIN1_CANON.get(country, {})
    # 2) admin1 名がトークンとして含まれるか（複合表記対応）
    tokens = [t.strip() for t in re.split(r"[,/;]", key) if t.strip()]
    # 完全一致（トークン単位）を優先
    for t in tokens:
        if t in canon:
            a1 = canon[t]
            others = [o for o in tokens if o != t and o not in DROP_TOKENS]
            a2 = others[0].title() if others else ""
            return (disp, a1, a2, "token")
    # 2値語 admin1（"nuevo oriente" 等）を含むか
    for name, a1 in canon.items():
        if " " in name and name in key:
            return (disp, a1, "", "token")
    # 単一トークンが canon にある場合
    if key in canon:
        return (disp, canon[key], "", "token")

    # 3) 判定不能
    return (disp, "", "", "unmatched")


# ---------------------------------------------------------------------------
# メイン
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true",
                    help="CSVに列を追加して書き戻す（既定はdry-run）")
    args = ap.parse_args()

    with INPUT_CSV.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    mapping = {}  # (country, raw) -> (clean, a1, a2, source)
    for r in rows:
        country = (r.get("Country.of.Origin") or "").strip()
        raw = r.get("Region") or ""
        res = normalize(country, raw)
        r["Region_clean"], r["Region_admin1"], r["Region_admin2"], r["Region_source"] = res
        if not is_blank(raw):
            mapping[(country, raw.strip())] = res

    # ---- レポート ----
    total = len(rows)
    src_counter = Counter(r["Region_source"] for r in rows)
    print(f"総行数: {total}")
    print("source内訳:", dict(src_counter))
    matched = sum(1 for r in rows if r["Region_admin1"])
    print(f"admin1 付与: {matched} ({matched/total*100:.1f}%) / "
          f"未付与: {total - matched} ({(total-matched)/total*100:.1f}%)")
    print()

    # 集約効果: 国別 raw distinct -> admin1 distinct、n>=5 群数
    per_country = defaultdict(lambda: {"raw": set(), "a1": Counter()})
    for r in rows:
        c = (r.get("Country.of.Origin") or "").strip() or "(EMPTY)"
        raw = r.get("Region") or ""
        if not is_blank(raw):
            per_country[c]["raw"].add(raw.strip().lower())
        if r["Region_admin1"]:
            per_country[c]["a1"][r["Region_admin1"]] += 1

    print(f'{"Country":30}{"raw":>5}{"admin1":>8}{"n>=5群":>8}{"未付与":>7}')
    tot_raw = tot_a1 = tot_big = 0
    for c in sorted(per_country, key=lambda x: -sum(per_country[x]["a1"].values())):
        d = per_country[c]
        n_raw = len(d["raw"])
        n_a1 = len(d["a1"])
        n_big = sum(1 for v in d["a1"].values() if v >= 5)
        c_rows = [r for r in rows if (r.get("Country.of.Origin") or "").strip() == c]
        n_un = sum(1 for r in c_rows if not r["Region_admin1"])
        tot_raw += n_raw
        tot_a1 += n_a1
        tot_big += n_big
        print(f"{c:30}{n_raw:>5}{n_a1:>8}{n_big:>8}{n_un:>7}")
    print("-" * 58)
    print(f'{"合計":28}{tot_raw:>6}{tot_a1:>8}{tot_big:>8}')
    print()
    print(f"味比較に使える admin1 群 (n>=5): {tot_big} 個")

    # 未付与の一覧（レビュー用）
    unmatched = sorted({(c, raw) for (c, raw), res in mapping.items()
                        if not res[1]})
    if unmatched:
        print(f"\n=== 未付与 raw 値 ({len(unmatched)}種) ===")
        for c, raw in unmatched:
            print(f"  [{c}] {raw}")

    # ---- 書き出し ----
    if args.write:
        out_fields = list(fieldnames)
        for col in NEW_COLS:
            if col not in out_fields:
                out_fields.append(col)
        with INPUT_CSV.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=out_fields, lineterminator="\n")
            w.writeheader()
            w.writerows(rows)
        print(f"\n[write] {INPUT_CSV} に {NEW_COLS} を追加しました")

        with MAPPING_CSV.open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(["Country", "Region_raw", "Region_clean",
                        "Region_admin1", "Region_admin2", "Region_source"])
            for (c, raw), (cl, a1, a2, src) in sorted(mapping.items()):
                w.writerow([c, raw, cl, a1, a2, src])
        print(f"[write] {MAPPING_CSV} を出力しました")
    else:
        print("\n(dry-run: 書き戻すには --write を付けてください)")


if __name__ == "__main__":
    main()
