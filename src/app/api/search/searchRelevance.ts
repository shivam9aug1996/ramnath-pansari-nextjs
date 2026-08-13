import { GROCERY_SYNONYM_GROUPS } from "./grocerySynonyms";

const CATEGORY_EXACT_BOOST = 100;
const CATEGORY_SUFFIX_BOOST = 80;
const COMPOUND_PENALTY = 50;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if `word` appears as a whole token inside `haystack` (case-insensitive). */
export function containsWholeWord(haystack: string, word: string): boolean {
  if (!haystack || !word) return false;
  const re = new RegExp(
    `(^|[^a-z0-9\\u0900-\\u097F])${escapeRegExp(word)}([^a-z0-9\\u0900-\\u097F]|$)`,
    "i",
  );
  return re.test(haystack);
}

function normalizeKey(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F]+/g, "")
    .trim();
}

/**
 * Longer synonym phrases from *other* grocery groups that contain `query`
 * as a whole word (e.g. query "rice" → "rice bran oil", "beaten rice").
 * Used to demote oil/poha/snack hits when the user searched the short staple term.
 */
export function getConflictingLongerTerms(
  query: string,
  groups: readonly (readonly string[])[] = GROCERY_SYNONYM_GROUPS,
): string[] {
  const q = query.normalize("NFC").toLowerCase().trim();
  if (!q) return [];

  const qKey = normalizeKey(q);
  const matchedGroupIndices = new Set<number>();

  groups.forEach((group, i) => {
    for (const term of group) {
      const t = term.toLowerCase();
      if (t === q || normalizeKey(term) === qKey) {
        matchedGroupIndices.add(i);
        break;
      }
    }
  });

  const conflicts = new Set<string>();
  groups.forEach((group, i) => {
    if (matchedGroupIndices.has(i)) return;
    for (const term of group) {
      const t = term.toLowerCase().trim();
      if (t.length <= q.length) continue;
      if (containsWholeWord(t, q)) {
        conflicts.add(t);
      }
    }
  });

  return Array.from(conflicts).sort((a, b) => b.length - a.length);
}

/** Union conflicting longer terms across all query variants. */
export function getConflictingLongerTermsForVariants(
  queryVariants: string[],
  groups: readonly (readonly string[])[] = GROCERY_SYNONYM_GROUPS,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of queryVariants) {
    for (const term of getConflictingLongerTerms(v, groups)) {
      if (seen.has(term)) continue;
      seen.add(term);
      out.push(term);
    }
  }
  return out.sort((a, b) => b.length - a.length);
}

export type RelevanceAdjustment = {
  categoryBoost: number;
  compoundPenalty: number;
  adjustment: number;
};

/**
 * Pure JS mirror of the aggregation boost/penalty — for tests and debugging.
 */
export function computeRelevanceAdjustment(
  category: string | null | undefined,
  name: string | null | undefined,
  queryVariants: string[],
  conflictingTerms?: string[],
): RelevanceAdjustment {
  const categoryLower = (category ?? "").toLowerCase().trim();
  const variants = queryVariants
    .map((v) => v.toLowerCase().trim())
    .filter(Boolean);

  let categoryBoost = 0;
  for (const v of variants) {
    if (categoryLower === v) {
      categoryBoost = Math.max(categoryBoost, CATEGORY_EXACT_BOOST);
    } else if (categoryLower.endsWith(` ${v}`)) {
      categoryBoost = Math.max(categoryBoost, CATEGORY_SUFFIX_BOOST);
    }
  }

  const conflicts =
    conflictingTerms ?? getConflictingLongerTermsForVariants(queryVariants);
  const haystack = `${name ?? ""} ${category ?? ""}`.toLowerCase();
  let compoundPenalty = 0;
  for (const term of conflicts) {
    if (haystack.includes(term.toLowerCase())) {
      compoundPenalty = COMPOUND_PENALTY;
      break;
    }
  }

  return {
    categoryBoost,
    compoundPenalty,
    adjustment: categoryBoost - compoundPenalty,
  };
}

export type ScoreMeta = "searchScore" | "textScore";

/**
 * Aggregation stages: Atlas/text score + category boost − compound penalty,
 * then sort by finalScore. Call only for relevance (when product sort is null).
 */
export function buildRelevanceSortStages(opts: {
  queryVariants: string[];
  scoreMeta: ScoreMeta;
}): Record<string, unknown>[] {
  const variants = Array.from(
    new Set(
      opts.queryVariants.map((v) => v.toLowerCase().trim()).filter(Boolean),
    ),
  );
  const conflictingTerms = getConflictingLongerTermsForVariants(variants);

  const categoryBoostBranches: Record<string, unknown>[] = [];
  for (const v of variants) {
    categoryBoostBranches.push({
      case: { $eq: ["$_categoryLower", v] },
      then: CATEGORY_EXACT_BOOST,
    });
  }
  for (const v of variants) {
    const suffix = ` ${v}`;
    categoryBoostBranches.push({
      case: {
        $and: [
          { $gte: [{ $strLenCP: "$_categoryLower" }, suffix.length] },
          {
            $eq: [
              {
                $substrCP: [
                  "$_categoryLower",
                  {
                    $subtract: [
                      { $strLenCP: "$_categoryLower" },
                      suffix.length,
                    ],
                  },
                  suffix.length,
                ],
              },
              suffix,
            ],
          },
        ],
      },
      then: CATEGORY_SUFFIX_BOOST,
    });
  }

  const penaltyOr =
    conflictingTerms.length === 0
      ? [{ $eq: [1, 0] }]
      : conflictingTerms.map((term) => ({
          $gte: [{ $indexOfCP: ["$_haystack", term.toLowerCase()] }, 0],
        }));

  return [
    {
      $addFields: {
        _searchScore: { $meta: opts.scoreMeta },
        _categoryLower: { $toLower: { $ifNull: ["$category", ""] } },
        _haystack: {
          $toLower: {
            $concat: [
              { $ifNull: ["$name", ""] },
              " ",
              { $ifNull: ["$category", ""] },
            ],
          },
        },
      },
    },
    {
      $addFields: {
        _categoryBoost:
          categoryBoostBranches.length === 0
            ? 0
            : {
                $switch: {
                  branches: categoryBoostBranches,
                  default: 0,
                },
              },
        _compoundPenalty: {
          $cond: [{ $or: penaltyOr }, COMPOUND_PENALTY, 0],
        },
      },
    },
    {
      $addFields: {
        _finalScore: {
          $subtract: [
            { $add: ["$_searchScore", "$_categoryBoost"] },
            "$_compoundPenalty",
          ],
        },
      },
    },
    // `_id` tie-breaker keeps skip/limit pagination stable when scores tie
    // (common for short/fuzzy queries like "for").
    { $sort: { _finalScore: -1, _id: 1 } },
    {
      $unset: [
        "_searchScore",
        "_categoryLower",
        "_haystack",
        "_categoryBoost",
        "_compoundPenalty",
        "_finalScore",
      ],
    },
  ];
}
