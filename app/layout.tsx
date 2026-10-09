import type { Metadata } from "next";
import "./globals.css";
import themeScript from "@/components/theme-script";

export const metadata: Metadata = {
  title: "DayForge",
  description: "A daily routine manager for university students.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: the inline script below adds the `dark` class
    // to <html> before React hydrates, so the attribute intentionally differs.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint to avoid a light flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-app text-slate-900 antialiased dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
