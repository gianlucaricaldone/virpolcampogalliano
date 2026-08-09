import type { Metadata } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import { BadgeAmbiente } from "@/components/layout/BadgeAmbiente";
import "./globals.css";

// Archivo e la sua Black: una famiglia sola, due voci. La Black riprende la
// scritta VIRPOL dello stemma — grottesca pesante, maiuscola, spaziata — e
// Archivo variabile porta il resto senza cambiare mondo. Geist era il default
// del template: corretto e senza carattere, come il resto di questa grafica.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Virpol Campogalliano",
  description: "Gestionale della società sportiva Virpol Campogalliano",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${archivo.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <BadgeAmbiente />
      </body>
    </html>
  );
}
