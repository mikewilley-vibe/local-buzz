import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Header } from "@/components/Header";
import { SiteFooter } from "@/components/SiteFooter";
import { PRODUCT_NAME } from "@/lib/brand";
import { regionPlaceName } from "@/lib/region";
import { getRequestRegion } from "@/lib/request-region";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const region = await getRequestRegion();
  const place = regionPlaceName(region);
  return {
    applicationName: PRODUCT_NAME,
    title: `${PRODUCT_NAME} — ${place} this week`,
    description:
      region === "rva"
        ? "Happy hours, food specials, trivia, and events at bars and restaurants in Richmond."
        : "Happy hours, food specials, trivia, and events at bars and restaurants in Hampton Roads.",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const region = await getRequestRegion();
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Header region={region} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
