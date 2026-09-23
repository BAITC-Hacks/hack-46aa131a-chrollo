import type { Metadata } from "next";
import "@fontsource/manrope/cyrillic-400.css";
import "@fontsource/manrope/cyrillic-500.css";
import "@fontsource/manrope/cyrillic-600.css";
import "@fontsource/manrope/cyrillic-700.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./globals.css";

export const metadata: Metadata={title:"QALA — Аким на 5 часов",description:"Пять решений. Один город. Симулятор городского управления с проверяемой моделью качества жизни и AI-анализом. Astana Innovations · HackAlem AI."};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="ru"><body>{children}</body></html>;
}
