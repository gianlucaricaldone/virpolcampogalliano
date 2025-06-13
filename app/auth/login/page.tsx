'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      let errorMessage = ''
      switch (error) {
        case 'otp_expired':
          errorMessage = 'Il link di accesso è scaduto. Richiedi un nuovo link.'
          break
        case 'session_failed':
          errorMessage = 'Errore nella creazione della sessione. Riprova.'
          break
        case 'exchange_error':
          errorMessage = 'Errore nell\'autenticazione. Riprova.'
          break
        case 'no_code':
          errorMessage = 'Link di accesso non valido. Richiedi un nuovo link.'
          break
        case 'auth_failed':
        default:
          errorMessage = 'Errore durante l\'autenticazione. Riprova.'
          break
      }
      setMessage(errorMessage)
    }
  }, [searchParams])

  const getRedirectURL = () => {
    // In produzione usa la variabile ambiente, altrimenti usa l'origin corrente
    const baseURL = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    return `${baseURL}/auth/callback`
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      console.log('[Login] Attempting login for:', email)
      console.log('[Login] Redirect URL:', getRedirectURL())

      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: getRedirectURL(),
          // Aumenta il tempo di validità del link (default è 1 ora)
          // Su mobile potrebbe essere necessario più tempo
          shouldCreateUser: false, // Non creare utenti automaticamente
        },
      })

      console.log('[Login] OTP result:', { data, error })

      if (error) {
        console.error('[Login] OTP error:', error)
        
        if (error.message.includes('signup_disabled') || error.message.includes('User not found')) {
          setMessage('Utente non trovato. Contatta l\'amministratore per essere aggiunto al sistema.')
        } else if (error.message.includes('rate_limit')) {
          setMessage('Troppi tentativi. Attendi qualche minuto prima di riprovare.')
        } else {
          setMessage('Errore durante l\'invio del link: ' + error.message)
        }
      } else {
        setMessage('Link di accesso inviato! Controlla la tua email (anche nello spam). Il link è valido per 1 ora.')
      }
    } catch (error: any) {
      console.error('[Login] Unexpected error:', error)
      setMessage('Errore imprevisto durante l\'accesso: ' + (error?.message || 'Errore sconosciuto'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Accedi al Sistema
          </h1>
          <p className="text-gray-600">
            Virpol Campogalliano
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="inserisci@email.it"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Invio in corso...' : 'Invia Link di Accesso'}
          </button>
        </form>

        {message && (
          <div className={`mt-4 p-3 rounded-md text-sm ${
            message.includes('Errore') || message.includes('scaduto') || message.includes('non valido')
              ? 'bg-red-50 text-red-700 border border-red-200' 
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {message}
            {(message.includes('scaduto') || message.includes('non valido')) && email && (
              <div className="mt-3">
                <button
                  onClick={() => {
                    setMessage('')
                    handleLogin({ preventDefault: () => {} } as React.FormEvent)
                  }}
                  className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                  disabled={loading}
                >
                  Richiedi nuovo link
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Torna alla homepage
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Caricamento...</p>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}