import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlightDeal",
  description: "Indexed award funding optimizer for Seats.aero availability.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
