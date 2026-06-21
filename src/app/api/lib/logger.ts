const isDev = process.env.NODE_ENV === "development";

export const log = (...args: unknown[]) => {
  if (isDev) console.log(...args);
};

export const logError = (...args: unknown[]) => {
  console.error(...args);
};

export const logWarn = (...args: unknown[]) => {
  if (isDev) console.warn(...args);
};

export const maskToken = (token?: string | null) => {
  if (!token) return null;
  if (token.length <= 12) return "***";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
};

export const logAuth = (step: string, data: Record<string, unknown>) => {
  if (isDev) console.log(`[auth] ${step}`, data);
};
