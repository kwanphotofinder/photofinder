import type React from "react";
import type { Metadata } from "next";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/500.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { ChatWrapper } from "@/components/chat-wrapper";
import "./globals.css";

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
import { LanguageProvider } from "@/lib/language-context";
import { DOMErrorPatch } from "@/components/dom-error-patch";

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
      <body className="font-sans antialiased">
        <DOMErrorPatch />
        <Script strategy="afterInteractive" src="https://accounts.google.com/gsi/client?hl=en" />
        <LanguageProvider>
          <VerificationGuard>
            {children}
          </VerificationGuard>
        </LanguageProvider>
        <ChatWrapper />
        <Analytics />
      </body>
    </html>
  );
}

