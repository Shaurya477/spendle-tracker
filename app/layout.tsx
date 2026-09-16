import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Backdrop } from "@/components/dashboard/backdrop";
import { Disclaimer } from "@/components/dashboard/disclaimer";
import { THEME_KEY } from "@/lib/theme";
import "./globals.css";

/** One family for display and text; the width and optical-size axes do the differentiation. */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Penconomics — Pendle fees, yield, and incentives",
  description:
    "Pendle's protocol fees, LP incentives, sPENDLE yield, and vePENDLE boost dilution, read from Ethereum contracts, Pendle's API, and DefiLlama.",
};

/** Runs before first paint: dark is the default, a stored "light" preference removes the class. */
const themeBootstrap = `try{if(localStorage.getItem(${JSON.stringify(THEME_KEY)})==="light")document.documentElement.classList.remove("dark")}catch{}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${bricolage.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Backdrop />
        <Disclaimer />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
