import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { APP_NAME } from "@/lib/config/constants";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Administration portal for a pre-owned car showroom"
};

/**
 * Three typefaces, each with a job:
 *
 *  - Geist      interface text. Neutral, tall x-height, reads well at 12–14px,
 *               which is most of this application.
 *  - Fraunces   display only — page titles and the wordmark. It carries the
 *               "Royal Cars" character without costing legibility in dense
 *               tables, because it never appears there.
 *  - Geist Mono tabular figures: money, odometer readings, stock and invoice
 *               references. Digits share one width, so columns of rupees line
 *               up and a transposed figure is visible at a glance.
 *
 * All three are variable fonts, self-hosted by next/font (no external request,
 * no layout shift) and exposed as CSS variables for Tailwind.
 */
const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans"
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono"
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  // Fraunces is an optical-size family; pin the axes so headings stay on the
  // low-"wonk" side rather than the decorative extreme.
  axes: ["SOFT", "WONK", "opsz"]
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * suppressHydrationWarning on <html> and <body> only.
     *
     * Browser extensions (Grammarly, password managers, Dark Reader) write
     * attributes onto these two elements before React hydrates —
     * `data-new-gr-c-s-check-loaded`, `data-gr-ext-installed` and similar. The
     * server cannot know about them, so React reports a mismatch the app can do
     * nothing about.
     *
     * The flag suppresses warnings for THESE elements' own attributes only. It
     * does not cascade, so a genuine mismatch anywhere inside the app is still
     * reported.
     */
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
