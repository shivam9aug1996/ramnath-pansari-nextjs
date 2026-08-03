import assert from "node:assert/strict";
import {
  expandSearchQueries,
  resolvePreferredTerm,
  GROCERY_SYNONYM_GROUPS,
} from "../grocerySynonyms";

assert.ok(GROCERY_SYNONYM_GROUPS.length >= 80, "expected expanded synonym coverage");

assert.ok(expandSearchQueries("chawal").includes("rice"));
assert.ok(expandSearchQueries("चावल").includes("rice"));
assert.ok(expandSearchQueries("fortune chawal").includes("fortune rice"));
assert.ok(expandSearchQueries("tel").includes("oil"));
assert.ok(expandSearchQueries("chini").includes("sugar"));
assert.ok(expandSearchQueries("poha").length >= 1);
assert.ok(expandSearchQueries("badam").includes("almond") || expandSearchQueries("badam").includes("almonds"));
assert.ok(expandSearchQueries("kaju").some((v) => v.includes("cashew")));
assert.ok(expandSearchQueries("sarson").some((v) => v.includes("mustard")));
assert.ok(expandSearchQueries("arhar").some((v) => v.includes("toor")));
assert.ok(expandSearchQueries("sabun").includes("soap"));
assert.equal(resolvePreferredTerm("chawal"), "rice");
assert.equal(resolvePreferredTerm("unknownxyz"), null);
assert.deepEqual(expandSearchQueries(""), []);

console.log(
  `grocerySynonyms tests passed (${GROCERY_SYNONYM_GROUPS.length} groups)`,
);
