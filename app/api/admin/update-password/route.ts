import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

export async function POST(request: Request) {
  try {
    // Verifica che l'utente sia autenticato e sia admin
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }
    
    // Verifica il ruolo admin
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }
    
    // Ottieni i dati dalla richiesta
    const { userId, password } = await request.json()
    
    if (!userId || !password) {
      return NextResponse.json({ error: 'userId e password sono richiesti' }, { status: 400 })
    }
    
    // Crea client admin e aggiorna la password
    const adminClient = createAdminClient()
    const { data, error } = await adminClient.auth.admin.updateUserById(
      userId,
      { password }
    )
    
    if (error) {
      console.error('Error updating password:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}