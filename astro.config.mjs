import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import { writeFileSync } from "node:fs";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: { enabled: true },
    sessions: false,
  }),
  vite: {
    plugins: [{
      name: 'write-assetsignore',
      closeBundle() {
        writeFileSync('dist/.assetsignore', '_worker.js\n_routes.json\n');
      }
    }]
  }
});
