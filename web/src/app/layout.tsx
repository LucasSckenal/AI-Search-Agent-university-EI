import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar, MobileDock } from "@/components/shared/Sidebar";
import { CommandPalette } from "@/components/shared/CommandPalette";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jbmono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://agentes-busca-ia.vercel.app"),
  title: "Agentes de Busca — Labirinto, Cubo Mágico e Jogo da Velha",
  description:
    "Aplicação interativa para configurar, executar, visualizar e comparar algoritmos clássicos de busca (BFS, DFS, UCS, Gulosa, A*, Minimax e Poda Alfa-Beta).",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jbmono.variable} h-full antialiased`}>
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- this IS the root layout (App Router equivalent of _document); the rule predates the App Router */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="h-full min-h-screen bg-black text-on-surface">
        <div className="app-shell">
          <Sidebar />
          <main className="main-shell">{children}</main>
        </div>
        <MobileDock />
        <CommandPalette />
      </body>
    </html>
  );
}
