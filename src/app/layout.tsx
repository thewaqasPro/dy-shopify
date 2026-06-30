import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DY Shopify Inventory",
  description: "Boss Logics to Shopify inventory sync dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
