import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { ToastProvider } from "@/context/ToastContext";
import ThemeProvider from "../components/ThemeProvider";
import Footer from "../components/Footer";
import { STRINGS } from "../lib/strings";
import UserProvider from "../components/UserProvider";
import { ReduxProvider } from "@/lib/redux/provider";
import ErrorBoundary from "@/components/ErrorBoundary";
import OfflineBanner from "@/components/OfflineBanner";
import CookieConsent from "@/components/CookieConsent";

import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import JsonLd from "@/components/JsonLd";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const BASE_URL = process.env.DOMAIN || "https://hapuslogistics.com";

export const metadata: Metadata = {
  title: {
    default: `${STRINGS.brand.appName} | Logistics & Courier Services`,
    template: `%s | ${STRINGS.brand.appName}`,
  },
  description: STRINGS.homeSubtitle + " Reliable express parcel delivery, logistics company in India, and fast courier services in Mumbai.",
  applicationName: STRINGS.brand.appName,
  keywords: [
    "Hapus Logistics",
    "logistics services",
    "delivery services India",
    "courier services Mumbai",
    "logistics company in Mumbai",
    "best courier partners India",
    "express delivery services",
  ],
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${STRINGS.brand.appName} | Logistics & Courier Services`,
    description: STRINGS.homeSubtitle,
    url: BASE_URL,
    siteName: STRINGS.brand.appName,
    locale: "en_IN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${roboto.variable} min-h-dvh bg-[#0b0f09] text-white antialiased`}>
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: STRINGS.brand.appName,
            url: BASE_URL,
            logo: `${BASE_URL}/icon.png`,
            description: STRINGS.brand.description,
            address: {
              "@type": "PostalAddress",
              streetAddress: "Shop No.1, Ramu Niwas, Near W.E. Highway",
              addressLocality: "Khar (East), Mumbai",
              addressRegion: "Maharashtra",
              postalCode: "400051",
              addressCountry: "IN",
            },
            contactPoint: {
              "@type": "ContactPoint",
              telephone: STRINGS.contact.phone,
              contactType: "customer service",
            },
          }}
        />
        <ReduxProvider>
          <LanguageProvider>
            <UserProvider>
              <ThemeProvider>
                <ToastProvider>
                  {/* App wrapper */}
                  <div className="flex min-h-dvh flex-col overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(213,228,0,0.05),transparent_28%),radial-gradient(circle_at_bottom,rgba(115,161,67,0.06),transparent_24%),linear-gradient(180deg,#0b0f09_0%,#090c08_100%)] text-white">
                    <OfflineBanner />
                    {/* Main content */}
                    <main className="flex-1 overflow-x-hidden">
                      <ErrorBoundary>
                        {children}
                      </ErrorBoundary>
                    </main>

                    {/* Footer always at bottom */}
                    <Footer />
                    
                    {/* Cookie Consent Banner */}
                    <CookieConsent />
                  </div>
                </ToastProvider>
              </ThemeProvider>
            </UserProvider>
          </LanguageProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
