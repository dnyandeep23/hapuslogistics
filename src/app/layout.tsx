import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { ToastProvider } from "@/context/ToastContext";
import ThemeProvider from "../components/ThemeProvider";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { STRINGS } from "../lib/strings";
import UserProvider from "../components/UserProvider";
import { ReduxProvider } from "@/lib/redux/provider";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

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
    <html lang="en">
      <body className={`${roboto.variable} antialiased`}>
        <ReduxProvider>
          <UserProvider>
            <ThemeProvider>
              <ToastProvider>
                {/* App wrapper */}
                <div className="min-h-screen flex flex-col">
                  {/* Main content */}
                  <main className="flex-1 ">{children}</main>

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
