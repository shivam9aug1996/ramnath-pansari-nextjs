/**
 * Hindi / Hinglish ↔ English grocery synonym groups.
 * Aligned with store categories in `products/categoryConfig.ts`.
 *
 * Used to expand /api/search queries before Atlas autocomplete
 * (autocomplete does not support Atlas synonym mappings).
 *
 * First entry in each group is the preferred catalog search term
 * (usually the English word that appears in product names).
 */
export const GROCERY_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  // ——— Staples / flours ———
  ["atta", "aata", "wheat flour", "gehun ka atta", "आटा"],
  ["besan", "gram flour", "chana flour", "बेसन"],
  ["maida", "all purpose flour", "refined flour", "मैदा"],
  ["sooji", "suji", "rava", "rawa", "semolina", "रवा", "सूजी"],
  ["daliya", "dalia", "broken wheat", "lapsi", "दलिया"],
  ["oats", "oatmeal", "ओट्स"],
  ["muesli", "म्यूज़ली", "म्यूसली"],
  ["flakes", "corn flakes", "cornflakes", "कॉर्न फ्लेक्स"],
  ["cereal", "breakfast cereal", "सीरियल"],
  ["poha", "powa", "beaten rice", "chiwda", "chiwra", "चिउड़ा", "पोहा"],
  ["sabudana", "sago", "tapioca", "साबूदाना"],
  ["murmura", "mamra", "puffed rice", "मुरमुरा", "ममरा"],

  // ——— Rice ———
  ["rice", "chawal", "chaawal", "chavl", "चावल"],
  ["basmati", "basmati rice", "बासमती"],
  ["sona masoori", "sona masuri", "sono masuri", "सोना मसूरी"],

  // ——— Dals / pulses ———
  ["dal", "daal", "pulse", "pulses", "दाल"],
  ["toor dal", "arhar", "arhar dal", "tuvar dal", "तोवर दाल", "अरहर"],
  ["moong dal", "mung dal", "moong", "मूंग दाल", "मूंग"],
  ["urad dal", "urid dal", "urad", "उड़द दाल", "उड़द"],
  ["masoor dal", "masoor", "मसूर दाल", "मसूर"],
  ["chana dal", "chana daal", "चना दाल"],
  ["kabuli chana", "chole", "chola", "white chana", "काबुली चना", "छोले"],
  ["kala chana", "black chana", "desi chana", "काला चना"],
  ["rajma", "kidney beans", "राजमा"],
  ["lobia", "lobhiya", "black eyed beans", "chowli", "लोबिया"],
  ["matar", "peas", "vatana", "मटर", "वताना"],
  ["matki", "moth beans", "matki beans", "मोठ"],
  ["peanuts", "groundnut", "moongphali", "mungfali", "मूंगफली"],
  ["soyabean", "soybean", "soya bean", "सोयाबीन"],

  // ——— Oils / fats ———
  ["oil", "tel", "तेल"],
  ["mustard oil", "sarson", "sarso", "sarson oil", "sarso oil", "sarson ka tel", "sarso ka tel", "sarso tel", "sarson tel", "सरसों का तेल", "सरसों", "सरसो"],
  ["groundnut oil", "peanut oil", "moongphali oil", "मूंगफली तेल"],
  ["sunflower oil", "surajmukhi oil", "सूरजमुखी तेल"],
  ["olive oil", "जैतून का तेल"],
  ["soyabean oil", "soybean oil", "soya oil", "सोया तेल"],
  ["rice bran oil", "राइस ब्रान ऑयल"],
  ["blended oil", "mixed oil"],
  ["vanaspati", "dalda", "वनस्पति"],
  ["ghee", "घी", "desi ghee"],
  ["butter", "makkhan", "margarine", "मक्खन"],

  // ——— Sugar / salt / sweeteners ———
  ["sugar", "chini", "cheeni", "चीनी"],
  ["salt", "namak", "नमक"],
  ["honey", "shahad", "शहद"],
  ["jam", "jelly", "जैम"],

  // ——— Dairy ———
  ["milk", "doodh", "dudh", "दूध"],
  ["milk powder", "doodh powder", "cream", "दूध पाउडर"],
  ["curd", "dahi", "दही"],
  ["yogurt", "yoghurt", "shrikhand", "श्रीखंड"],
  ["buttermilk", "chaas", "chhach", "lassi", "छाछ", "लस्सी", "छाश"],
  ["cheese", "processed cheese", "चीज़", "चीज"],
  ["paneer", "cottage cheese", "पनीर"],
  ["tofu", "टोफू"],
  ["condensed milk", "mithai doodh"],
  ["flavoured milk", "flavored milk", "milkshake", "smoothie"],

  // ——— Bread / bakery ———
  ["pav", "bun", "buns", "pizza base", "पाव", "बन"],
  ["bread", "double roti", "डबल रोटी"],
  ["rusk", "toast", "रस्क"],
  ["cake", "cakes", "केक"],
  ["cream roll", "cream rolls"],

  // ——— Tea / coffee ———
  ["tea", "chai", "chay", "चाय"],
  ["tea bags", "tea bag", "gourmet tea"],
  ["coffee", "kaafi", "कॉफी"],
  ["instant coffee", "nescafe"],
  ["ground coffee", "filter coffee"],

  // ——— Snacks / biscuits / sweets ———
  ["namkeen", "savoury", "savory snacks", "नमकीन"],
  ["biscuit", "biscuits", "cookie", "cookies", "बिस्किट"],
  ["marie", "digestive", "health biscuit"],
  ["wafer", "wafers", "cream biscuit"],
  ["chocolate", "chocolates", "चॉकलेट", "चॉकलेट्स"],
  ["toffee", "candy", "candies", "mithai", "टॉफी"],
  ["chikki", "gajak", "चिक्की"],
  ["mint", "gum", "chewing gum"],
  ["papad", "papads", "papadum", "पापड़"],

  // ——— Beverages ———
  ["juice", "juices", "रस", "जूस"],
  ["cold drink", "cold drinks", "soft drink", "soda", "thanda", "ठंडा"],
  ["energy drink", "energy drinks"],
  ["nutritional drink", "horlicks", "bourvita", "boost"],
  ["water", "pani", "mineral water", "packaged water", "पानी"],

  // ——— Instant / ready ———
  ["noodles", "noodle", "maggi", "hakka", "cup noodles", "नूडल्स"],
  ["pasta", "macaroni", "पास्ता", "मैकरोनी"],
  ["vermicelli", "sewai", "sewaiyan", "semiya", "सेवई", "सेवइयाँ"],
  ["soup", "soups", "सूप"],
  ["ready meal", "ready to eat", "heat and eat"],
  ["dessert mix", "kheer mix", "custard"],
  ["breakfast mix", "snack mix"],

  // ——— Sauces / spreads / pickles ———
  ["ketchup", "sauce", "tomato sauce", "चटनी", "सॉस"],
  ["mayonnaise", "mayo", "मेयो"],
  ["chutney", "चटनी"],
  ["pickle", "achaar", "achar", "अचार"],
  ["spread", "nutella", "peanut butter", "choco spread"],
  ["soya sauce", "soy sauce", "chilli sauce"],

  // ——— Spices ———
  ["masala", "spice", "spices", "मसाला", "मसाले"],
  ["powdered spices", "mirch powder", "haldi", "haldee", "jeera powder", "हल्दी", "मिर्च"],
  ["haldi", "turmeric", "हल्दी"],
  ["mirch", "chilli", "chili", "lal mirch", "मिर्च"],
  ["jeera", "cumin", "जीरा"],
  ["dhania", "coriander", "धनिया"],
  ["hing", "asafoetida", "हींग"],
  ["whole spices", "sabut masala", "खड़े मसाले"],
  ["cooking paste", "ginger garlic paste", "adrak lehsun"],
  ["herbs", "seasoning", "oregano", "mixed herbs"],

  // ——— Dry fruits / nuts ———
  ["dry fruits", "dry fruit", "मेवे", "सूखे मेवे"],
  ["badam", "almond", "almonds", "बादाम"],
  ["kaju", "cashew", "cashews", "काजू"],
  ["kishmish", "raisin", "raisins", "किशमिश"],
  ["akhrot", "walnut", "walnuts", "अखरोट"],
  ["pista", "pistachio", "pistachios", "पिस्ता"],
  ["dates", "khajoor", "khajur", "खजूर"],
  ["makhana", "fox nuts", "lotus seeds", "मखाना"],
  ["dry dates", "chuara", "chuhara", "छुहारा"],

  // ——— Fresh / common kitchen (search aliases) ———
  ["onion", "pyaz", "pyaaz", "प्याज"],
  ["potato", "aloo", "alu", "आलू"],
  ["tomato", "tamatar", "टमाटर"],
  ["garlic", "lahsun", "lasun", "lehsun", "लहसुन", "लसुन"],
  ["ginger", "adrak", "अदरक"],
  ["lemon", "nimbu", "neembu", "नीबू", "निम्बू"],
  ["egg", "anda", "ande", "अंडा", "अण्डा"],
  ["wheat", "gehun", "gehu", "गेहूं", "गेहू"],

  // ——— Personal care ———
  ["soap", "sabun", "bathing bar", "साबुन"],
  ["shampoo", "शैंपू", "शैम्पू"],
  ["conditioner", "कंडिशनर"],
  ["hair oil", "tel baal", "amla oil", "coconut oil hair", "बालों का तेल"],
  ["hair color", "hair dye", "mehndi", "मेंहदी", "मेंदी"],
  ["toothpaste", "tooth paste", "dant manjan", "टूथपेस्ट", "मंजन"],
  ["toothbrush", "tooth brush", "टूथब्रश"],
  ["mouthwash", "mouth wash"],
  ["face wash", "face cleanser", "फेस वॉश"],
  ["moisturizer", "face cream", "body lotion", "cream", "लोशन"],
  ["talcum", "talc", "powder", "टेलकम"],
  ["sunscreen", "sun screen", "spf"],
  ["deodorant", "deodorants", "deo", "perfume", "perfume spray", "डियो"],
  ["sanitizer", "hand wash", "handwash", "सैनिटाइज़र"],
  ["shower gel", "body wash", "बॉडी वॉश"],
  ["sanitary napkin", "sanitary pad", "pads", "पैड"],
  ["shaving", "razor", "shave gel"],

  // ——— Health / wellness ———
  ["ayurvedic", "herbal", "आयुर्वेदिक"],
  ["pain relief", "pain reliever", "balm", "ointment", "दर्द"],
  ["cough", "cold remedy", "vicks", "खांसी", "सर्दी"],
  ["digestive", "hajmola", "eno", "पचने की दवा"],
  ["antiseptic", "dettol", "savlon"],
  ["supplement", "supplements", "multivitamin", "विटामिन"],

  // ——— Baby ———
  ["diaper", "diapers", "nappy", "nappies", "डायपर"],
  ["baby wipes", "wipes", "वाइप्स"],
  ["baby soap", "baby shampoo", "baby oil", "baby lotion"],
  ["infant formula", "baby formula", "baby milk", "फॉर्मूला"],

  // ——— Household cleaning / home care ———
  ["detergent", "washing powder", "surf", "ariel", "detergents", "डिटर्जेंट"],
  ["disinfectant", "floor cleaner", "phenyl", "lizol", "फिनाइल"],
  ["dishwash", "dish wash", "vim", "dishwashing", "dish soap", "बर्तन धोने का साबुन"],
  ["toilet cleaner", "harpic", "toilet cleaners", "हार्पिक"],
  ["air freshener", "odonil", "room freshener", "फ्रेशनर"],
  ["mosquito repellent", "all out", "goodknight", "good knight", "मच्छरदानी", "मच्छर"],
  ["agarbatti", "incense", "dhoop", "incense sticks", "अगरबत्ती", "धूप"],
  ["pooja", "puja", "pooja needs", "puja samagri", "पूजा"],
];

const MAX_QUERY_VARIANTS = 5;

function normalizeToken(token: string): string {
  return token
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F]+/g, "")
    .trim();
}

function normalizeQuery(query: string): string {
  return query.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Map normalized token → full synonym group (including itself). */
function buildLookup(): Map<string, readonly string[]> {
  const map = new Map<string, readonly string[]>();
  for (const group of GROCERY_SYNONYM_GROUPS) {
    for (const term of group) {
      const key = normalizeToken(term);
      if (!key) continue;
      // Keep original group strings (with spaces) so preferred term stays "mustard oil"
      if (!map.has(key)) {
        map.set(key, group);
      }
    }
  }
  return map;
}

const LOOKUP = buildLookup();

const QUERY_STOPWORDS = new Set([
  "ka",
  "ki",
  "ke",
  "ko",
  "se",
  "of",
  "the",
  "a",
  "an",
  "and",
  "aur",
]);

/** Common Hinglish / brand typos before synonym expansion. */
const QUERY_TYPOS: Record<string, string> = {
  tek: "tel",
  teel: "tel",
  cheeni: "chini",
  chinee: "chini",
  chaawal: "chawal",
  sarsonn: "sarson",
  // Atlas fuzzy uses prefixLength: 2, so early typos like fr→fo never fuzzy-match
  frtune: "fortune",
  fotune: "fortune",
  fortne: "fortune",
  fortuen: "fortune",
};

function applyTypos(query: string): string {
  return query
    .split(/\s+/)
    .map((t) => QUERY_TYPOS[t.toLowerCase()] ?? t)
    .join(" ");
}

/**
 * Rebuild query using each token's preferred catalog term, collapsing
 * redundant generics (e.g. sarso+tel → "mustard oil", not "mustard oil oil").
 */
function preferredCatalogQuery(tokens: string[]): string | null {
  const meaningful = tokens.filter(
    (t) => !QUERY_STOPWORDS.has(normalizeToken(t)),
  );
  const parts: string[] = [];
  let changed = false;

  for (const token of meaningful) {
    const norm = normalizeToken(token);
    const preferred = LOOKUP.get(norm)?.[0];
    if (preferred && normalizeToken(preferred) !== norm) {
      changed = true;
      for (const p of preferred.split(/\s+/)) {
        const pl = p.toLowerCase();
        if (parts.includes(pl)) continue;
        if (
          (pl === "oil" || pl === "tel") &&
          parts.some((x) => x === "oil" || x.endsWith("oil"))
        ) {
          continue;
        }
        parts.push(pl);
      }
    } else if (norm) {
      const pl = norm.toLowerCase();
      if (
        (pl === "oil" || pl === "tel") &&
        parts.some((x) => x.includes("oil") || x === "mustard")
      ) {
        if (!parts.includes("oil") && parts.includes("mustard")) {
          parts.push("oil");
        }
        continue;
      }
      if (!parts.includes(pl)) parts.push(pl);
    }
  }

  if (!changed || parts.length === 0) return null;
  return parts.join(" ");
}

/**
 * Also try multi-word synonym keys inside the full query
 * (e.g. "sarson ka tel" → "mustard oil").
 */
function expandPhraseMatches(original: string, variants: Set<string>) {
  const lower = original.toLowerCase();
  for (const group of GROCERY_SYNONYM_GROUPS) {
    for (const term of group) {
      const t = term.toLowerCase();
      if (t.length < 3) continue;
      if (!lower.includes(t)) continue;
      for (const syn of group) {
        if (syn.toLowerCase() === t) continue;
        variants.add(normalizeQuery(lower.split(t).join(syn.toLowerCase())));
      }
      // Always include the preferred catalog term for this group
      if (group[0]) variants.add(group[0]);
    }
  }
}

/**
 * Expand a user search query into Atlas autocomplete query variants.
 * Prefers English catalog terms so vernacular queries like "sarso tel"
 * rank mustard oil instead of random "oil" products.
 */
export function expandSearchQueries(rawQuery: string): string[] {
  const corrected = applyTypos(normalizeQuery(rawQuery));
  const original = normalizeQuery(corrected);
  if (!original) return [];

  const variants = new Set<string>();
  variants.add(original);

  const lower = original.toLowerCase();
  if (lower !== original) variants.add(lower);

  expandPhraseMatches(original, variants);

  const tokens = original.split(" ").filter(Boolean);
  const normalizedTokens = tokens.map(normalizeToken);

  const preferred = preferredCatalogQuery(tokens);
  if (preferred) {
    // Strong vernacular hit — search catalog English first so "sarso tel"
    // doesn't rank random tea-tree / hair oils from the word "tel".
    const strong = [preferred, original].filter(
      (v, i, arr) => v && arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i,
    );
    return strong.slice(0, MAX_QUERY_VARIANTS);
  }

  if (tokens.length === 1) {
    const group = LOOKUP.get(normalizedTokens[0]);
    if (group) {
      for (const syn of group) variants.add(syn);
    }
  } else {
    for (let i = 0; i < normalizedTokens.length; i++) {
      const group = LOOKUP.get(normalizedTokens[i]);
      if (!group) continue;
      // Prefer adding the group's primary catalog term alone
      if (group[0]) variants.add(group[0]);
      for (const syn of group) {
        if (syn === normalizedTokens[i]) continue;
        // Skip injecting multi-word synonyms mid-phrase ("mustard oil tel")
        if (syn.includes(" ")) continue;
        const next = [...tokens];
        next[i] = syn;
        variants.add(next.join(" "));
      }
    }
  }

  const ordered = Array.from(variants)
    .map(normalizeQuery)
    .filter(Boolean)
    .sort((a, b) => {
      // Prefer English catalog-looking queries over raw vernacular
      const aPref = preferred && a === preferred ? -2 : 0;
      const bPref = preferred && b === preferred ? -2 : 0;
      if (aPref !== bPref) return aPref - bPref;
      if (a === "mustard oil" && b !== "mustard oil") return -1;
      if (b === "mustard oil" && a !== "mustard oil") return 1;
      const aAscii = /^[\x00-\x7F]+$/.test(a) ? 0 : 1;
      const bAscii = /^[\x00-\x7F]+$/.test(b) ? 0 : 1;
      if (aAscii !== bAscii) return aAscii - bAscii;
      if (a === original) return 1;
      if (b === original) return -1;
      return a.length - b.length;
    });

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const v of ordered) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(v);
  }

  return deduped.slice(0, MAX_QUERY_VARIANTS);
}

/** Preferred English/catalog term for a vernacular token, if any. */
export function resolvePreferredTerm(token: string): string | null {
  const group = LOOKUP.get(normalizeToken(token));
  return group?.[0] ?? null;
}
