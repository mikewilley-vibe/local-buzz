import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Header } from "@/components/Header";
import {
  ICON_SRC,
  PRODUCT_NAME,
  SUPPORTING_DESCRIPTION,
  TAGLINE,
} from "@/lib/brand";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} — ${SUPPORTING_DESCRIPTION}`,
  description: `${SUPPORTING_DESCRIPTION} Happy hours, food specials, trivia, and events at bars and restaurants in Hampton Roads.`,
  applicationName: PRODUCT_NAME,
  openGraph: {
    title: `${PRODUCT_NAME} — ${TAGLINE}`,
    description: SUPPORTING_DESCRIPTION,
    type: "website",
    images: [{ url: ICON_SRC, width: 192, height: 192, alt: PRODUCT_NAME }],
  },
  twitter: {
    card: "summary",
    title: `${PRODUCT_NAME} — ${TAGLINE}`,
    description: SUPPORTING_DESCRIPTION,
    images: [ICON_SRC],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
