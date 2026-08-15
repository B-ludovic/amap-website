import path from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* `eslint-config-next` 15 est encore écrit à l'ancien format : il exporte un
   objet `{ extends: ["…/index.js", "plugin:@next/next/core-web-vitals"] }`.
   Ni le `...` d'un tableau ni le `extends` de `defineConfig` ne savent lire la
   chaîne `plugin:…` — d'où les deux erreurs successives, « nextVitals is not
   iterable » puis « Plugin "" not found ». `FlatCompat` est le traducteur
   officiel entre les deux formats : il rend un vrai tableau de configs plates. */
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    // Reprend les ignores par défaut d'eslint-config-next.
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
