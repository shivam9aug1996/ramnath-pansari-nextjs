import {
  buildShopAssistUserPrompt,
  sanitizeShopAssistPlan,
  SHOP_ASSIST_SYSTEM_PROMPT,
} from "./sanitizePlan";

describe("sanitizeShopAssistPlan", () => {
  it("parses clean search JSON", () => {
    const plan = sanitizeShopAssistPlan(
      JSON.stringify({
        action: "search",
        keyword: "fortune mustard oil",
        preferSize: "1l",
        preferQty: 3,
        index: null,
        message: null,
      }),
    );
    expect(plan).toMatchObject({
      action: "search",
      keyword: "fortune mustard oil",
      preferSize: "1l",
      preferQty: 3,
    });
  });

  it("strips markdown fences", () => {
    const plan = sanitizeShopAssistPlan(
      "```json\n{\"action\":\"ask\",\"message\":\"Kaunsa oil?\",\"keyword\":null,\"preferSize\":null,\"preferQty\":null,\"index\":null}\n```",
    );
    expect(plan.action).toBe("ask");
    expect(plan.message).toMatch(/Kaunsa oil/i);
  });

  it("rejects search without keyword", () => {
    const plan = sanitizeShopAssistPlan(
      JSON.stringify({ action: "search", keyword: null }),
    );
    expect(plan.action).toBe("none");
  });

  it("rejects pick without index", () => {
    const plan = sanitizeShopAssistPlan(
      JSON.stringify({ action: "pick", index: null }),
    );
    expect(plan.action).toBe("none");
  });

  it("clamps preferQty and drops invalid", () => {
    expect(
      sanitizeShopAssistPlan(
        JSON.stringify({
          action: "search",
          keyword: "sugar",
          preferQty: 99,
        }),
      ).preferQty,
    ).toBeNull();
    expect(
      sanitizeShopAssistPlan(
        JSON.stringify({
          action: "search",
          keyword: "sugar",
          preferQty: 2,
        }),
      ).preferQty,
    ).toBe(2);
  });

  it("falls back on garbage", () => {
    expect(sanitizeShopAssistPlan("not json").action).toBe("none");
    expect(sanitizeShopAssistPlan("").action).toBe("none");
  });

  it("allows checkout and cart_list", () => {
    expect(
      sanitizeShopAssistPlan(JSON.stringify({ action: "checkout" })).action,
    ).toBe("checkout");
    expect(
      sanitizeShopAssistPlan(JSON.stringify({ action: "cart_list" })).action,
    ).toBe("cart_list");
  });
});

describe("buildShopAssistUserPrompt", () => {
  it("includes candidates", () => {
    const prompt = buildShopAssistUserPrompt({
      userText: "pehla wala",
      candidates: [{ i: 1, name: "Fortune Oil", size: "1 L" }],
    });
    expect(prompt).toMatch(/pehla wala/);
    expect(prompt).toMatch(/1\. Fortune Oil \(1 L\)/);
    expect(SHOP_ASSIST_SYSTEM_PROMPT).toMatch(/JSON/);
  });
});
