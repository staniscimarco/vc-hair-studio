import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { CustomerTabBar, CustomerTopNav } from "@/components/nav/customer-tab-bar";
import { InstallHint } from "@/components/pwa/install-hint";
import { NotificationPrompt } from "@/components/pwa/notification-prompt";
import { Splash } from "@/components/pwa/splash";
import { PullToRefresh } from "@/components/pwa/pull-to-refresh";

const lexend = Lexend({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-lexend",
});

export const metadata: Metadata = {
  title: { default: "VC Hair Studio", template: "%s · VC Hair Studio" },
  description: "La bellezza dei tuoi capelli inizia da qui. Prenota il tuo prossimo appuntamento.",
  applicationName: "VC Hair Studio",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "VC Hair Studio", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#5826B2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={lexend.variable}>
      <body className="min-h-screen antialiased">
        <a className="skip-link" href="#contenuto">
          Vai al contenuto
        </a>
        <CustomerTopNav />
        <main id="contenuto">{children}</main>
        <CustomerTabBar />
        <InstallHint />
        <NotificationPrompt />
        <PullToRefresh />
        <Splash />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
