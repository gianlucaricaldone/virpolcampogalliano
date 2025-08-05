import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

export async function GET() {
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
    
    // Crea client admin e ottieni la lista degli utenti
    const adminClient = createAdminClient()
    const { data: authUsers, error } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000 // Aumenta se hai più di 1000 utenti
    })
    
    if (error) {
      console.error('Error listing users:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ 
      users: authUsers.users,
      total: authUsers.users.length 
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}