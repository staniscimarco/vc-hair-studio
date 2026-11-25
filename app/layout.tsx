import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { InstallHint } from "@/components/pwa/install-hint";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: { default: "VC Hair Studio", template: "%s · VC Hair Studio" },
  description: "La bellezza dei tuoi capelli inizia da qui. Prenota il tuo prossimo appuntamento.",
  applicationName: "VC Hair Studio",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "VC Hair Studio", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#69423C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen antialiased">
        <a className="skip-link" href="#contenuto">
          Vai al contenuto
        </a>
        <Suspense fallback={<div className="h-20" />}>
          <SiteHeader />
        </Suspense>
        <main id="contenuto">{children}</main>
        <Suspense>
          <SiteFooter />
        </Suspense>
        <InstallHint />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
