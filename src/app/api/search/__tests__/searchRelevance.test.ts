import assert from "node:assert/strict";
import {
  computeRelevanceAdjustment,
  containsWholeWord,
  getConflictingLongerTerms,
  getConflictingLongerTermsForVariants,
  buildRelevanceSortStages,
} from "../searchRelevance";

// —— containsWholeWord ——
assert.equal(containsWholeWord("rice bran oil", "rice"), true);
assert.equal(containsWholeWord("basmati rice", "rice"), true);
assert.equal(containsWholeWord("price tag", "rice"), false);
assert.equal(containsWholeWord("riced", "rice"), false);

// —— conflicting longer terms for "rice" ——
{
  const conflicts = getConflictingLongerTerms("rice");
  assert.ok(
    conflicts.includes("rice bran oil"),
    `expected rice bran oil in ${JSON.stringify(conflicts)}`,
  );
  assert.ok(
    conflicts.includes("beaten rice"),
    `expected beaten rice in ${JSON.stringify(conflicts)}`,
  );
  assert.ok(
    conflicts.includes("puffed rice"),
    `expected puffed rice in ${JSON.stringify(conflicts)}`,
  );
  // Same-group peers must not be treated as conflicts
  assert.ok(!conflicts.includes("rice"));
  assert.ok(!conflicts.includes("chawal"));
  assert.ok(!conflicts.includes("chaawal"));
}

{
  const conflicts = getConflictingLongerTermsForVariants([
    "chawal",
    "rice",
    "चावल",
  ]);
  assert.ok(conflicts.includes("rice bran oil"));
  assert.ok(conflicts.includes("beaten rice"));
}

// —— scoring: rice categories beat oil / snack ——
{
  const variants = ["rice", "chawal"];
  const rice = computeRelevanceAdjustment(
    "Rice",
    "Charminar Rozana Rice 5 Kg",
    variants,
  );
  const basmati = computeRelevanceAdjustment(
    "Basmati Rice",
    "Daawat Super Basmati Rice 1 Kg",
    variants,
  );
  const oil = computeRelevanceAdjustment(
    "Rice Bran Oil",
    "Fortune Rice Brain Refined Rice Bran Oil 435 Kg",
    variants,
  );
  const kachri = computeRelevanceAdjustment(
    "Papads, Ready To Fry",
    "Malika Rice Kachri 200 G",
    variants,
  );

  assert.equal(rice.categoryBoost, 100);
  assert.equal(rice.compoundPenalty, 0);
  assert.equal(basmati.categoryBoost, 80);
  // basmati name hits conflicting "basmati rice" from another group
  assert.equal(basmati.compoundPenalty, 50);
  assert.ok(
    rice.adjustment > oil.adjustment,
    `rice (${rice.adjustment}) should beat oil (${oil.adjustment})`,
  );
  assert.ok(
    basmati.adjustment > oil.adjustment,
    `basmati (${basmati.adjustment}) should beat oil (${oil.adjustment})`,
  );
  assert.ok(
    rice.adjustment > kachri.adjustment,
    `rice (${rice.adjustment}) should beat kachri (${kachri.adjustment})`,
  );
  assert.ok(
    basmati.adjustment > kachri.adjustment,
    `basmati (${basmati.adjustment}) should beat kachri (${kachri.adjustment})`,
  );
  assert.equal(oil.compoundPenalty, 50);
  assert.equal(kachri.categoryBoost, 0);
  assert.equal(kachri.compoundPenalty, 0);

  // With equal Atlas base scores, final order is rice > basmati > kachri > oil
  const base = 10;
  const finals = [
    { id: "rice", score: base + rice.adjustment },
    { id: "basmati", score: base + basmati.adjustment },
    { id: "kachri", score: base + kachri.adjustment },
    { id: "oil", score: base + oil.adjustment },
  ].sort((a, b) => b.score - a.score);
  assert.deepEqual(
    finals.map((f) => f.id),
    ["rice", "basmati", "kachri", "oil"],
  );
}

// —— aggregation stages shape ——
{
  const stages = buildRelevanceSortStages({
    queryVariants: ["rice", "chawal"],
    scoreMeta: "searchScore",
  });
  assert.ok(stages.length >= 4);
  assert.ok(stages.some((s) => "$sort" in s));
  assert.ok(stages.some((s) => "$unset" in s));
  const sortStage = stages.find((s) => "$sort" in s) as {
    $sort: Record<string, number>;
  };
  assert.deepEqual(sortStage.$sort, { _finalScore: -1, _id: 1 });
  const addFields = stages.filter((s) => "$addFields" in s);
  assert.ok(addFields.length >= 2);
  const first = addFields[0] as { $addFields: { _searchScore: unknown } };
  assert.deepEqual(first.$addFields._searchScore, { $meta: "searchScore" });
}

{
  const stages = buildRelevanceSortStages({
    queryVariants: ["rice"],
    scoreMeta: "textScore",
  });
  const first = stages[0] as { $addFields: { _searchScore: unknown } };
  assert.deepEqual(first.$addFields._searchScore, { $meta: "textScore" });
}

console.log("searchRelevance tests passed");
