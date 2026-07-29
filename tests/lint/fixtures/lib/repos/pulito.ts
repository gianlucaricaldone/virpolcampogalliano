// Sorgente di prova: file dentro una directory sorvegliata che NON viola la
// regola. Serve a distinguere "la regola scatta sul motivo giusto" da
// "la regola scatta su tutto".
import { leggiEnv } from '../env'

export const pulito = () => leggiEnv({})
