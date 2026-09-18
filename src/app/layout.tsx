import { Fraunces, Outfit } from "next/font/google";
import { Header } from "@/components/Header";
import { PRODUCT_NAME } from "@/lib/brand";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata = {
  applicationName: PRODUCT_NAME,
  title: `${PRODUCT_NAME} — Hampton Roads this week`,
  description:
    "Happy hours, food specials, trivia, and events at bars and restaurants in Hampton Roads.",
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
