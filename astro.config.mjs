import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import { writeFileSync } from "node:fs";

function assetsIgnore() {
  return {
    name: 'assetsignore',
    hooks: {
      'astro:build:done': () => {
        writeFileSync('dist/.assetsignore', '_worker.js\n_routes.json\n');
      }
    }
  };
}

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: { enabled: true },
    sessions: false,
  }),
  integrations: [assetsIgnore()],
});
