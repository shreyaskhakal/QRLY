import type { Metadata, Viewport } from "next";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "QRLY - QR Print Kiosk",
  description: "Scan, upload, pay by UPI, and print automatically with zero wait and privacy by default.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <LanguageProvider>
          <main className="mx-auto min-h-screen max-w-md bg-white shadow-sm sm:border-x sm:border-slate-200">
            {children}
          </main>
        </LanguageProvider>
      </body>
    </html>
  );
}

