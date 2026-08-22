import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Configuração do Vite + plugin de PWA.
// O plugin gera o manifest.json e o service worker automaticamente
// a partir das opções abaixo — é o que faz "Adicionar à tela inicial"
// funcionar e o app abrir em tela cheia, sem barra do navegador.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "TR Stock",
        short_name: "TR Stock",
        description: "Controle de estoque da TR",
        start_url: "/",
        display: "standalone",
        background_color: "#141414",
        theme_color: "#141414",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
