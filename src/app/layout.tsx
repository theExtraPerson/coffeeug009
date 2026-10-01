import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import { BRAND_NAME, BRAND_TAGLINE, COMPANY_NAME, SITE_URL } from "@/lib/platform";
import "./globals.css";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });

const title = `${BRAND_NAME} | ${BRAND_TAGLINE}`;
const description =
  "Activate a coffee processing plant with CoffeeUG and collect your returns at 10PM every day for 20 days.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  applicationName: BRAND_NAME,
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: BRAND_NAME },
  // The logo doubles as the favicon and the app icon, so the mark appears on
  // the site, the installed app, and every shared link.
  icons: {
    icon: [{ url: "/brand/logo.jpg", type: "image/jpeg" }],
    apple: [{ url: "/brand/logo.jpg", type: "image/jpeg" }],
    shortcut: ["/brand/logo.jpg"],
  },
  openGraph: {
    title,
    description,
    siteName: COMPANY_NAME,
    type: "website",
    locale: "en_UG",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: "#0B0C11",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${grotesk.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
