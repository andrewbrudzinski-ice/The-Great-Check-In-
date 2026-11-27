import type { Metadata, Viewport } from "next";
import { Archivo, Geist_Mono, Inter } from "next/font/google";
import { preconnect } from "react-dom";
import { Shell } from "@/components/Shell";
import { SUPABASE_URL } from "@/lib/config";
import { AppProvider } from "@/lib/store";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-geist-mono", display: "swap" });

// iPhone launch screens (public/splash): the mark on black while the app opens.
// One image per screen size, as [width, height, pixel ratio] in CSS px.
const SPLASH: [number, number, number][] = [
  [440, 956, 3],
  [430, 932, 3],
  [420, 912, 3],
  [402, 874, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [375, 667, 2],
  [320, 568, 2],
];

export const metadata: Metadata = {
  title: "The Great Check In",
  description: "5 check-ins. Every week. No excuses.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: {
    capable: true,
    title: "Check In",
    statusBarStyle: "black-translucent",
    startupImage: SPLASH.map(([w, h, r]) => ({
      url: `/splash/${w * r}x${h * r}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    })),
  },
  // Older iPhones only use launch images when they see Apple's own tag.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Open the connection to the database while the app's code downloads, so the first fetch doesn't wait for it.
  if (SUPABASE_URL) preconnect(SUPABASE_URL, { crossOrigin: "anonymous" });
  return (
    <html lang="en" className={`${archivo.variable} ${inter.variable} ${mono.variable}`}>
      <body>
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
