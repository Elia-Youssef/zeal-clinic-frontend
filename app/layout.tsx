import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/contexts/theme-context";
import { LoadingOverlay } from "@/components/loading-overlay";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clinic Dashboard",
  description: "Clinic application dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <LoadingOverlay />
        </ThemeProvider>
      </body>
    </html>
  );
}
