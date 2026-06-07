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
