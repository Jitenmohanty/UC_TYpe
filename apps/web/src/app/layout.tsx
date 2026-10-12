import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routewise | Travel operations",
  description: "Bookings, fleet and accounts in one travel operations workspace."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
