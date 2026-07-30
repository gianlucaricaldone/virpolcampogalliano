import { z } from 'zod'
import { facoltativo, facoltativoIntero } from '@/lib/validation/comune'

// CATEGORIE sta in `lib/costanti.ts`: la legge anche un form client, e
// importarla da qui gli farebbe scaricare zod.

export const schemaSquadra = z.object({
  nome: z.string().trim().min(1, 'Il nome è obbligatorio'),
  categoria: z.string().trim().min(1, 'La categoria è obbligatoria'),
  annata: facoltativoIntero(
    z.number().int('L\'annata è un anno').min(1900, 'Annata non plausibile').max(2100, 'Annata non plausibile'),
  ),
  note: facoltativo(z.string()),
})

export function campiSquadra(form: FormData): Record<string, unknown> {
  return {
    nome: form.get('nome'),
    categoria: form.get('categoria'),
    annata: form.get('annata'),
    note: form.get('note'),
  }
}
