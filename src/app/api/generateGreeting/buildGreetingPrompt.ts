export type GreetingType = "weather" | "cart" | "batch";

export type WeatherGreetingPayload = {
  weatherDescription?: string;
  weatherMain?: string;
  timeOfDay?: string;
};

export type CartGreetingPayload = {
  cartItems?: string[];
  recentlyViewedItems?: string[];
  orderedItems?: string[];
  timeOfDay?: string;
};

export type BatchGreetingPayload = {
  timeOfDay?: string;
  weatherDescription?: string;
  weatherMain?: string;
  cartItems?: string[];
  recentlyViewedItems?: string[];
  orderedItems?: string[];
  /** Current active delivery status, e.g. confirmed | out_for_delivery | none */
  activeOrderStatus?: string;
  /** Product names from the active order(s) */
  activeOrderedItems?: string[];
};

export type GreetingPayload =
  | WeatherGreetingPayload
  | CartGreetingPayload
  | BatchGreetingPayload;

export type StructuredGreetingRequest = {
  type: GreetingType;
  payload?: GreetingPayload;
};

function asStringList(value: unknown, max = 5): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, max);
}

function asTrimmedString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function activityDescription(
  cartItems: string[],
  recentlyViewedItems: string[],
  orderedItems: string[],
) {
  const hasCart = cartItems.length > 0;
  const hasViewed = recentlyViewedItems.length > 0;
  const hasOrdered = orderedItems.length > 0;

  if (hasOrdered && hasCart) {
    return "The user has past grocery orders and items in their cart.";
  }
  if (hasOrdered) {
    return "The user has ordered groceries before and may want to reorder staples.";
  }
  if (hasCart && hasViewed) {
    return "The user recently added items to their cart and viewed other products.";
  }
  if (hasCart) return "The user recently added items to their cart.";
  if (hasViewed) {
    return "The user recently viewed products but has an empty cart.";
  }
  return "The user has not browsed products yet.";
}

export function buildPromptFromStructuredRequest(
  type: GreetingType,
  payload: GreetingPayload | undefined,
): string {
  if (type === "batch") {
    const data = (payload || {}) as BatchGreetingPayload;
    const timeOfDay = asTrimmedString(data.timeOfDay, "day");
    const weatherDescription = asTrimmedString(
      data.weatherDescription,
      "mild weather",
    );
    const weatherMain = asTrimmedString(data.weatherMain, "Clear");
    const cartItems = asStringList(data.cartItems);
    const recentlyViewedItems = asStringList(data.recentlyViewedItems);
    const orderedItems = asStringList(data.orderedItems);
    const activeOrderStatus = asTrimmedString(data.activeOrderStatus, "none");
    const activeOrderedItems = asStringList(data.activeOrderedItems);

    return [
      `Time of day: ${timeOfDay}.`,
      `Weather: ${weatherDescription} (${weatherMain}).`,
      activityDescription(cartItems, recentlyViewedItems, orderedItems),
      `Cart items: ${cartItems.length ? cartItems.join(", ") : "none"}.`,
      `Recently viewed: ${recentlyViewedItems.length ? recentlyViewedItems.join(", ") : "none"}.`,
      `Previously ordered: ${orderedItems.length ? orderedItems.join(", ") : "none"}.`,
      `Active delivery status: ${activeOrderStatus}.`,
      `Active order items: ${activeOrderedItems.length ? activeOrderedItems.join(", ") : "none"}.`,
      "Write TWO different homepage banners:",
      "1) weather: warm Hinglish line that mentions weather and groceries.",
      "2) cart: friendly English/Hinglish nudge.",
      "If active delivery status is confirmed or out_for_delivery, the cart line should briefly acknowledge that order (and name 1 item if provided).",
      "If active delivery status is none and previously ordered items exist, subtly suggest reordering 1-2 staples.",
      "Otherwise use cart/recent views.",
      'Return ONLY JSON: {"weather":"...","cart":"..."} with no markdown.',
    ].join(" ");
  }

  if (type === "weather") {
    const data = (payload || {}) as WeatherGreetingPayload;
    const weatherDescription = asTrimmedString(
      data.weatherDescription,
      "mild weather",
    );
    const weatherMain = asTrimmedString(data.weatherMain, "Clear");
    const timeOfDay = asTrimmedString(data.timeOfDay, "day");

    return [
      `Time of day: ${timeOfDay}.`,
      `Weather: ${weatherDescription} (${weatherMain}).`,
      "Write one warm Hinglish homepage banner that mentions the weather naturally and encourages browsing groceries.",
    ].join(" ");
  }

  const data = (payload || {}) as CartGreetingPayload;
  const cartItems = asStringList(data.cartItems);
  const recentlyViewedItems = asStringList(data.recentlyViewedItems);
  const orderedItems = asStringList(data.orderedItems);
  const timeOfDay = asTrimmedString(data.timeOfDay, "day");

  return [
    `Time of day: ${timeOfDay}.`,
    activityDescription(cartItems, recentlyViewedItems, orderedItems),
    `Cart items: ${cartItems.length ? cartItems.join(", ") : "none"}.`,
    `Recently viewed: ${recentlyViewedItems.length ? recentlyViewedItems.join(", ") : "none"}.`,
    `Previously ordered: ${orderedItems.length ? orderedItems.join(", ") : "none"}.`,
    "Write one friendly homepage banner that nudges them to keep shopping. If previously ordered items exist, subtly suggest reordering 1-2 staples.",
  ].join(" ");
}

export function parseStructuredGreetingBody(
  body: unknown,
): StructuredGreetingRequest | null {
  if (!body || typeof body !== "object") return null;

  const record = body as Record<string, unknown>;
  const type = record.type;
  if (type !== "weather" && type !== "cart" && type !== "batch") return null;

  const payload =
    record.payload && typeof record.payload === "object"
      ? (record.payload as GreetingPayload)
      : undefined;

  return { type, payload };
}
