import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Disclaimer } from "@/components/dashboard/disclaimer";
import { THEME_KEY } from "@/lib/theme";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      className={`dark ${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Disclaimer />
        {children}
      </body>
    </html>
  );
}
