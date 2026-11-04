import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "../components/Toast";
import { ConfirmDialogContainer } from "../components/ConfirmDialog";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ChromeDoApp } from "../components/ChromeDoApp";

const inter = Inter({ subsets: ["latin"] });

// METADADOS NATIVOS PARA PWA (Android e Apple iOS)
export const metadata: Metadata = {
  title: "Nexa Premium",
  description: "Seu controle financeiro inteligente",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nexa",
  },
};

// Zoom liberado: bloquear o zoom e barreira de acessibilidade real para quem
// tem baixa visao, e um app financeiro e lido com atencao e com a vista
// cansada. O ganho de impedir zoom acidental nao paga esse custo.
export const viewport: Viewport = {
  themeColor: "#080b0f",
  width: "device-width",
  initialScale: 1,
  // Sem viewportFit "cover", env(safe-area-inset-*) devolve 0 e o app nao
  // consegue se desviar do notch nem da barra de gestos.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-canvas text-ink antialiased selection:bg-brand/25 px-safe`}>
        <ErrorBoundary>{children}</ErrorBoundary>
        {/* Aviso e confirmação ficam no raiz: a tela de login também mostra
            erro de senha. O resto da moldura só existe para quem entrou. */}
        <ToastContainer />
        <ConfirmDialogContainer />
        <ChromeDoApp />
      </body>
    </html>
  );
}
