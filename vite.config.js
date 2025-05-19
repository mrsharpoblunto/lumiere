import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const config = {
    publicDir: resolve(__dirname, "audio"),
  };

  if (mode === "client") {
    return {
      ...config,
      root: resolve(__dirname, "src/client"),
      build: {
        outDir: resolve(__dirname, "dist/client"),
        emptyOutDir: true,
        rollupOptions: {
          input: {
            main: resolve(__dirname, "src/client/index.html"),
          },
        },
        assetsInlineLimit: 4096,
      },
    };
  } else if (mode === "www") {
    return {
      ...config,
      root: resolve(__dirname, "src/www"),
      build: {
        outDir: resolve(__dirname, "dist/www"),
        emptyOutDir: true,
        rollupOptions: {
          input: {
            main: resolve(__dirname, "src/www/index.html"),
          },
        },
        assetsInlineLimit: 4096,
      },
    };
  }

  return config;
});
