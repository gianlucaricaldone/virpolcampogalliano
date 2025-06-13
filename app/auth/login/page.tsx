'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [loginMode, setLoginMode] = useState<'magic' | 'password'>('magic')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      let errorMessage = ''
      switch (error) {
        case 'otp_expired':
          errorMessage = 'Il link di accesso è scaduto. Prova con username e password.'
          setLoginMode('password')
          break
        case 'session_failed':
          errorMessage = 'Errore nella creazione della sessione su mobile. Usa username e password.'
          setLoginMode('password')
          break
        case 'exchange_error':
          errorMessage = 'Errore nell\'autenticazione. Prova con username e password.'
          setLoginMode('password')
          break
        case 'no_code':
          errorMessage = 'Link di accesso non valido. Prova con username e password.'
          setLoginMode('password')
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
      if (loginMode === 'password') {
        console.log('[Login] Attempting password login for:', email)
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        console.log('[Login] Password result:', { data, error })

        if (error) {
          console.error('[Login] Password error:', error)
          
          if (error.message.includes('Invalid login credentials')) {
            setMessage('Email o password non corretti.')
          } else if (error.message.includes('rate_limit')) {
            setMessage('Troppi tentativi. Attendi qualche minuto prima di riprovare.')
          } else {
            setMessage('Errore durante il login: ' + error.message)
          }
        } else {
          console.log('[Login] Password login successful, redirecting to dashboard')
          router.push('/dashboard')
        }
      } else {
        console.log('[Login] Attempting magic link login for:', email)
        console.log('[Login] Redirect URL:', getRedirectURL())

        const { data, error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: getRedirectURL(),
            shouldCreateUser: false,
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

        {/* Toggle Metodo Login */}
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setLoginMode('magic')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginMode === 'magic' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Link via Email
          </button>
          <button
            type="button"
            onClick={() => setLoginMode('password')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              loginMode === 'password' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Username e Password
          </button>
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

          {loginMode === 'password' && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Inserisci la password"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Accesso in corso...' : 
             loginMode === 'password' ? 'Accedi' : 'Invia Link di Accesso'}
          </button>
        </form>

        {/* Suggerimento per mobile */}
        {loginMode === 'magic' && (
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-700">
              📱 <strong>Su mobile?</strong> Se hai problemi con il link email, 
              usa "Username e Password" qui sopra per un accesso più affidabile.
            </p>
          </div>
        )}

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