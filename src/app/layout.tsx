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

export const metadata: Metadata = {
  title: STRINGS.appName,
  description: STRINGS.homeSubtitle,
  applicationName: STRINGS.appName,
  keywords: "",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${roboto.variable} min-h-dvh bg-[#0b0f09] text-white antialiased`}>
        <ReduxProvider>
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
                </div>
              </ToastProvider>
            </ThemeProvider>
          </UserProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
