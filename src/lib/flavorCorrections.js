// Correction rules for mis-extracted flavor tags, kept identical to keep_tag()
// in scripts/flavor_analysis.py (neru, #120) so that the site and the analysis
// count the same tags. When a rule changes there, change it here too.
//
// Except for Honey, a tag is only dropped when its word appears in the
// description and every occurrence matches a false-positive pattern: the
// stored description is cut at 500 characters, so a missing word does not
// mean the tag is wrong.

// 1. Honey: honey process and its other spellings (red honey, dried as a honey, …)
const HONEY_PROCESS = new RegExp(
  "\\b(" +
    "honey[\\s-]*(process|processed|processing|method|lot|prep|preparation|ferment\\w*)" +
    "|(white|yellow|gold|golden|red|black|pink|anaerobic|double\\s+anaerobic|natural|washed|pulped|semi)[\\s-]+honey" +
    "|dried\\s+as\\s+(a\\s+)?honey" +
    "|process(ing|ed)?\\s*[:\\-|]\\s*[^\\n.;,]*?\\bhoney" +
    ")\\b",
  "gi",
);
const HONEY_WORD = /\bhoney\b/i;

// 2. Cherry: the coffee cherry as harvested fruit (coffee cherry, cherry maturation, …)
const CHERRY_FALSE = new RegExp(
  "\\b(" +
    "coffee\\s+cherry" +
    "|whole\\s+cherry" +
    "|in-cherry" +
    "|(in|within|with|of|from|their|its)\\s+(the\\s+|its\\s+)?cherry\\b(?!\\s*(notes?|flavou?rs?|aromas?|sweetness|acidity|jam|cola|pie|cobbler|blossom|compote|liqueur|syrup))" +
    "|cherry\\s+(integrity|intake|matur\\w*|ripen\\w*|harvest\\w*|pick\\w*|handpick\\w*|deliver\\w*|select\\w*|sort\\w*|float\\w*|pulp\\w*|ferment\\w*|dry\\w*|dried|wash\\w*|process\\w*|skin|mucilage|reception|collection|stage|intact|weight|lot|lots|price|prices|buying|purchase\\w*|farmers?|producers?|trees?|flotation|oxidation|development|handling|supply|collector|clerk|mosto|fruit)" +
    "|cherry\\s+(is|was|are|were|for\\s+this\\s+lot|from\\s+each|from\\s+local|from\\s+small\\w*|from\\s+farmers|from\\s+around)" +
    "|(deliver\\w*|harvest\\w*|handpick\\w*|hand-pick\\w*|float\\w*|pulp\\w*|depulp\\w*|ferment\\w*|process\\w*|wash\\w*|collect\\w*|contribut\\w*|receiv\\w*|buy|buying|purchas\\w*|pick|picked|picking|hand-sorted|managed|every|each|own|catuai|bourbon)\\s+(the\\s+|their\\s+|ripe\\s+|red\\s+|fresh\\s+|freshly\\s+|picked\\s+|whole\\s+|coffee\\s+){0,2}cherry" +
    "|dried\\s+(whole\\s+)?in\\s+(the\\s+|its\\s+|whole\\s+)?cherry" +
    "|slow(er|s)?\\s+(the\\s+ripening\\s+of\\s+every\\s+)?cherry" +
    "|la\\s+cereza\\s*\\(\\s*the\\s+cherry\\s*\\)" +
    ")\\b",
  "gi",
);
const CHERRY_WORD = /\bcherry\b/i;

// 3. Orange: "orange blossom" also tagged as the fruit
const ORANGE_FALSE = /\borange[\s-]+blossoms?\b/gi;
const ORANGE_WORD = /\boranges?\b/i;

// 4. Apple: apple blossom and other fruits named "… apple"
const APPLE_FALSE =
  /\b(apple[\s-]+blossoms?|(custard|sugar|star|rose|mammy|cashew|water|malay|wood|pond|kei)[\s-]+apples?)\b/gi;
const APPLE_WORD = /\bapples?\b/i;

// 5. Rose: the verb (popularity rose), varieties and names (Bourbon Rose, …)
const ROSE_FALSE = new RegExp(
  "\\b(" +
    "rose\\s+(to|from|up|above|out|in\\s+popularity|quickly|rapidly|again|by)" +
    "|(popularity|temperature|prices?|sun|smoke|steam|skating|coffee|varietal|sl-?28)\\s+rose" +
    "|bourbon\\s+rose" +
    "|flamant\\s+rose" +
    "|rose\\s+dos\\s+santos" +
    "|santa\\s+rose" +
    "|rose\\s+(street|crop|production|apple)" +
    ")\\b",
  "gi",
);
const ROSE_WORD = /\brose\b/i;

const WORD_RULES = {
  Cherry: [CHERRY_WORD, CHERRY_FALSE],
  Orange: [ORANGE_WORD, ORANGE_FALSE],
  Apple: [APPLE_WORD, APPLE_FALSE],
  Rose: [ROSE_WORD, ROSE_FALSE],
};

/** Whether to keep a tag (descriptor = last part of its SCA path). */
export function keepTag(descriptor, raw = "") {
  if (descriptor === "Honey")
    // keep only when honey appears other than as the process
    return HONEY_WORD.test(raw.replace(HONEY_PROCESS, ""));
  const rule = WORD_RULES[descriptor];
  if (rule) {
    const [word, falsePositive] = rule;
    if (word.test(raw) && !word.test(raw.replace(falsePositive, "")))
      return false;
  }
  return true;
}
