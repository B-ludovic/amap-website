import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      /* Le cookie de session n'appartient qu'à l'API : les données authentifiées
         se chargent forcément côté client, au montage, dans un effet. */
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Reprend les ignores par défaut d'eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
