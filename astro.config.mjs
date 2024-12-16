import { SITE } from "./src/config";
import { defineConfig, passthroughImageService } from "astro/config";

import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  base: SITE.base != "/" ? SITE.base : undefined,
  site: SITE.url,
  server: {
    host: true,
    open: true,
  },
  integrations: [
    tailwind({
      nesting: true,
    }),
  ],
   image: {
   service: passthroughImageService(),
 },
});
