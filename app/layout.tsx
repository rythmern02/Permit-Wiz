import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Permit-Wiz | Gasless Signature Tool for Rootstock",
  description:
    "Generate, sign, and verify ERC-2612 Permit payloads for gasless transactions on Rootstock. Debug EIP-712 signatures instantly.",
  keywords: [
    "Rootstock",
    "RSK",
    "ERC-2612",
    "Permit",
    "EIP-712",
    "Gasless",
    "RIF Relay",
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading the request headers opts the page out of static generation so the
  // middleware-issued `x-nonce` is available. Next.js automatically forwards
  // the nonce to any built-in <script> tags it renders, eliminating the need
  // for `'unsafe-inline'` in the production CSP `script-src`.
  await headers();

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
