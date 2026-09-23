import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

// Mismos pesos que carga el prototipo
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata = {
  title: "Protocolo — Quiz",
  description: "Quiz sobre protocolos en dinámicas D/s",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141311",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
