import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/components/AppProviders";
import { DEFAULT_THEME, themeBootstrapScript } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Excel Connect Hub",
  description:
    "A digital hub connecting students with learning resources, university services, communities, opportunities, and businesses."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The theme colour follows Midnight; the browser chrome cannot read the
  // per-user theme before paint, so it takes the default.
  themeColor: "#0b0d11"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before the first paint. Without it every page
            load flashes the default palette before React hydrates. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
