import type React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Thai, Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { ChatWrapper } from "@/components/chat-wrapper";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const _notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-thai",
});
const _outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Campus Event & Photo Finder",
  description: "Find your photos from campus events using AI face search",
  generator: "v0.app",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Photo Finder",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

import { VerificationGuard } from "@/components/verification-guard";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#82181a" />
      </head>
      <body className={`${_notoSansThai.variable} ${_outfit.variable} font-sans antialiased`}>
        <Script strategy="afterInteractive" src="https://accounts.google.com/gsi/client?hl=en" />
        <VerificationGuard>
          {children}
        </VerificationGuard>
        <ChatWrapper />
        <Analytics />
      </body>
    </html>
  );
}

