import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ramnath Pansari",
  description: "Ramnath Pansari",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="fast2sms" content="IXnaFm3TaNDs3a9WTvoZylwTuPvobVsl" />
      </head>

      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
