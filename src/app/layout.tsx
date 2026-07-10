import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SyncProvider } from "@/components/SyncProvider";
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
  title: "WebAR Temple Guide",
  description: "Explore sacred temples in Nepal through Web-based Augmented Reality and interactive audio guides.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AR Guide",
  },
};

export const viewport: Viewport = {
  themeColor: "#d97706",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head />
      <body className="min-h-full flex flex-col">
        <OfflineBanner />
        <SerwistProvider swUrl="/serwist/sw.js">
          <SyncProvider>{children}</SyncProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
