import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { isClerkConfigured } from "@/lib/auth-config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OmniDoxa",
  description: "Topic-first news intelligence.",
};

const themeInitScript = `
(() => {
  try {
    const storedTheme = window.localStorage.getItem("omnidoxa-theme");
    const theme = storedTheme === "light" ? "light" : "dark";
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.classList.add("dark");
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const app = <ThemeProvider>{children}</ThemeProvider>;
  const bodyContent = isClerkConfigured() ? (
    <ClerkProvider>{app}</ClerkProvider>
  ) : (
    app
  );

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {bodyContent}
      </body>
    </html>
  );
}
