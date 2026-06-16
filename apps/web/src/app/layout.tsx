import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "../components/providers/Providers";
import { AppShell } from "../components/layout/AppShell";
import "../../styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CryptoPay",
  description: "Spend digital assets through local payment rails.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground min-h-screen antialiased selection:bg-blue-500/30`}>
        <Providers>
          <AppShell>
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
