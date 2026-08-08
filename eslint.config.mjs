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

const messaggioEnvScript =
  'scripts/env legge la chiave service role: può essere importato solo da ' +
  'scripts/, altrimenti produce un client che ignora ogni RLS quanto ' +
  'lib/supabase/admin.'

const messaggioServizio =
  'lib/supabase/servizio usa la chiave service role e ignora ogni RLS: ' +
  'può essere importato solo da app/(app)/admin/utenti/actions.ts, che crea ' +
  'gli utenti applicativi.'

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // I percorsi sorvegliati. `tests/lint/fixtures/app/**` e
    // `tests/lint/fixtures/lib/repos/**` sono inclusi di proposito:
    // tengono la regola stessa sotto test.
    files: [
      'app/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'lib/repos/**/*.{ts,tsx}',
      'tests/lint/fixtures/app/**/*.{ts,tsx}',
      'tests/lint/fixtures/lib/repos/**/*.{ts,tsx}',
    ],
    rules: {
      // `regex`, non `group`: `group` confronta glob sul testo letterale
      // dello specifier, quindi un import relativo che da lib/repos/ non
      // riscrive il segmento `lib` (es. '../supabase/admin') gli sfuggiva.
      // La regex intercetta ogni import che termina in /supabase/admin,
      // alias o relativo.
      'no-restricted-imports': ['error', {
        patterns: [{
          regex: '(^|/)supabase/admin$',
          message: messaggioAdmin,
        }, {
          regex: '(^|/)scripts/env$',
          message: messaggioEnvScript,
        }, {
          regex: '(^|/)supabase/servizio$',
          message: messaggioServizio,
        }],
      }],
    },
  },
  {
    // Unica eccezione al divieto, e la più stretta possibile: un file solo,
    // non una cartella. Un 'use client' dentro app/(app)/admin/utenti/ che
    // importasse il client di servizio spedirebbe la chiave nel bundle del
    // browser; con l'eccezione su questo singolo percorso non può accadere.
    // Il lato permesso non ha una fixture: lo dimostra il file vero, perché
    // se l'eccezione smettesse di funzionare `npm run lint` fallirebbe su di
    // lui. Vedi docs/superpowers/specs/2026-07-30-gestione-utenti-design.md.
    files: ['app/(app)/admin/utenti/actions.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { regex: '(^|/)supabase/admin$', message: messaggioAdmin },
          { regex: '(^|/)scripts/env$', message: messaggioEnvScript },
        ],
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
    // supabase/.temp è generato da `supabase start` (bundle dell'edge
    // runtime): non è tracciato da git (vedi supabase/.gitignore) ma
    // ESLint non legge i .gitignore annidati, quindi va escluso qui.
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**", "lib/db/types.ts", "playwright-report/**", "supabase/.temp/**"],
  },
];

export default eslintConfig;
