import countries from "i18n-iso-countries";
import ja from "i18n-iso-countries/langs/ja.json";
import en from "i18n-iso-countries/langs/en.json";

countries.registerLocale(ja);
countries.registerLocale(en);

const countryNameOverrides = {
  "Tanzania, United Republic Of": "タンザニア",
  "United States (Puerto Rico)": "プエルトリコ",
  "United States (Hawaii)": "ハワイ",
  Laos: "ラオス",
  China: "中国",
};

export function toJapaneseCountryName(countryEn) {
  if (!countryEn) return "";

  if (countryNameOverrides[countryEn]) {
    return countryNameOverrides[countryEn];
  }

  const code = countries.getAlpha2Code(countryEn, "en");

  if (!code) {
    return countryEn;
  }

  return countries.getName(code, "ja") ?? countryEn;
}
