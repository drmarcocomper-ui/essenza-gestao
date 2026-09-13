import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

import RegisterSW from "@/components/RegisterSW";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Essenza",
  description: "Gestão do salão",
  // O iOS ignora o manifest: ícone da tela inicial e modo standalone saem
  // daqui. O Android lê os dois, e o manifest é quem vale lá.
  appleWebApp: {
    capable: true,
    title: "Essenza",
    // "default" mantém a barra de status escura sobre fundo claro — o app
    // não tem dark mode, e "black-translucent" jogaria o header para baixo
    // do relógio.
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Sem dark mode: barra do navegador sempre clara.
  themeColor: "#ffffff",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white text-neutral-900">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
