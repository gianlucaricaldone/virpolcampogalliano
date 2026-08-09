import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BadgeAmbiente } from "@/components/layout/BadgeAmbiente";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Virpol Campogalliano",
  description: "Gestionale della società sportiva Virpol Campogalliano",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <BadgeAmbiente />
      </body>
    </html>
  );
}
