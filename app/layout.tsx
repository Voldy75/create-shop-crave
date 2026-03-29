import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { UserProvider } from "./context/UserContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Crave & Create - AI Food Companion",
  description:
    "Your personal AI food companion. Discover recipes or find the perfect restaurant based on your cravings.",
  openGraph: {
    title: "Crave & Create - AI Food Companion",
    description:
      "Discover recipes or find the perfect restaurant based on your cravings.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
