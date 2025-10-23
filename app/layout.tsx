import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canadian Insights",
  description: "Made for Canadians, by Canadians",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="antialiased bg-gray-50 h-full m-0 p-0">{children}</body>
    </html>
  );
}

