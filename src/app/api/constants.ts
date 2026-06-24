export const baseUrl =
  !process.env.NODE_ENV || process.env.NODE_ENV === "development"
    ? "http://10.150.228.233:3000/api"
    : "https://ramnath-pansari-nextjs.vercel.app/api";

export const hostUrl = baseUrl.replace("/api", "");
