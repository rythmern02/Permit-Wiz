import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
