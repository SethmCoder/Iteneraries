import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "Plan, organize, and collaborate on business travel itineraries in one place.",
  applicationName: APP_NAME,
  // Icons come from file conventions so they always win over the default
  // Next.js favicon on reload: src/app/favicon.ico, icon.png, icon.svg, apple-icon.png
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#176B87" },
    { media: "(prefers-color-scheme: dark)", color: "#12566D" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full overflow-x-hidden font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
