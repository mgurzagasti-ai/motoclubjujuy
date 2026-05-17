import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moto Club Jujuy | 6 Motoencuentro Internacional",
  description:
    "Sitio oficial de Moto Club Jujuy y del 6 Motoencuentro Internacional 2026.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
