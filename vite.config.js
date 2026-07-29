import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    basicSsl(), // ✅ adiciona https
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "icons/apple-touch-icon.png",
        // Manuais + viewer HTML precisam ser precached para funcionar offline
        // e para o SW NÃO servir o index.html do SPA no lugar.
        "manuais/viewer.html",
        "manuais/manual-completo.md",
        "manuais/manual-motorista.md",
        "manuais/manual-encarregado.md",
        "manuais/manual-frota.md",
        "manuais/manual-dp.md",
        "manuais/manual-seguranca.md",
        "manuais/manual-medicao.md",
        "manuais/manual-performance.md",
        "manuais/manual-admin.md",
      ],
      workbox: {
        // O default do Workbox faz NavigationRoute → index.html para QUALQUER
        // request de navegação HTML. Isso quebra links diretos para
        // /manuais/viewer.html (SW devolve o SPA, o React manda pro login).
        // A denylist abaixo faz o SW deixar essas rotas passarem direto para
        // o servidor estático (Render/Vite), que serve o HTML/MD reais.
        navigateFallbackDenylist: [/^\/manuais\//],
        // Também precacheia .md além dos defaults (js/css/html/png/svg/ico).
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,md}"],
      },
      manifest: {
        name: "MACRO AMBIENTAL — Frota",
        short_name: "Macro Frota",
        description: "Gestão operacional de frota, motoristas, checklists e vistorias.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#F5F7FA",
        theme_color: "#0F2542",
        lang: "pt-BR",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      }
    })
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
  },

  esbuild: {
    loader: "jsx",
    include: /src\/.*\.[jt]sx?$/,
    exclude: [],
  },

  optimizeDeps: {
    esbuildOptions: {
      loader: { ".js": "jsx" },
    },
  },

  server: {
    port: 3000,
    host: true,
    strictPort: false,
  },

  build: {
    outDir: "build",
    sourcemap: true,
  },
});