import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const messaggioAdmin =
  'lib/supabase/admin usa la chiave service role e ignora ogni RLS: ' +
  'può essere importato solo da scripts/.'

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // I percorsi sorvegliati. `tests/lint/fixtures/app/**` è incluso di proposito:
    // tiene la regola stessa sotto test.
    files: [
      'app/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'lib/repos/**/*.ts',
      'tests/lint/fixtures/app/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/lib/supabase/admin', '@/lib/supabase/admin'],
          message: messaggioAdmin,
        }],
      }],
    },
  },
  {
    // Il prefisso underscore segnala un parametro o una destrutturazione
    // volutamente non usati: le Server Action ricevono `_precedente` da
    // useActionState e non lo leggono mai.
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**", "lib/db/types.ts", "playwright-report/**"],
  },
];

export default eslintConfig;
