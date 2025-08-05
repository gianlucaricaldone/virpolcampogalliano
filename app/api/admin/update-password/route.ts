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
    const { userId, email, password } = await request.json()
    
    if ((!userId && !email) || !password) {
      return NextResponse.json({ error: 'userId/email e password sono richiesti' }, { status: 400 })
    }
    
    console.log('Attempting to update password for:', { userId, email })
    
    // Crea client admin
    const adminClient = createAdminClient()
    
    // Se abbiamo l'email, usiamo quella per trovare l'utente (più affidabile)
    if (email) {
      console.log('Searching for auth user by email:', email)
      
      // Lista tutti gli utenti e trova quello con l'email corrispondente
      const { data: authUsers, error: listError } = await adminClient.auth.admin.listUsers()
      
      if (listError) {
        console.error('Error listing users:', listError)
        return NextResponse.json({ error: 'Errore nel recupero utenti' }, { status: 500 })
      }
      
      const authUser = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
      
      if (!authUser) {
        console.error('User not found in auth system with email:', email)
        
        // L'utente non esiste in auth.users, proviamo a crearlo
        console.log('Creating new auth user with email:', email)
        
        const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true, // Conferma automaticamente l'email
          user_metadata: {
            created_via: 'admin_password_setup'
          }
        })
        
        if (createError) {
          console.error('Error creating auth user:', createError)
          
          // Se l'errore è dovuto a email duplicata, prova a cercare di nuovo
          if (createError.message?.includes('already exists')) {
            console.log('User already exists, searching again...')
            const { data: retryUsers } = await adminClient.auth.admin.listUsers()
            const foundUser = retryUsers?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
            
            if (foundUser) {
              const { data, error } = await adminClient.auth.admin.updateUserById(
                foundUser.id,
                { password }
              )
              
              if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 })
              }
              
              return NextResponse.json({ success: true, data })
            }
          }
          
          return NextResponse.json({ error: `Errore nella creazione utente: ${createError.message}` }, { status: 500 })
        }
        
        console.log('Auth user created successfully:', newAuthUser?.user?.id)
        return NextResponse.json({ success: true, data: newAuthUser })
      }
      
      console.log('Found auth user, updating password for auth ID:', authUser.id)
      
      // Aggiorna la password
      const { data, error } = await adminClient.auth.admin.updateUserById(
        authUser.id,
        { password }
      )
      
      if (error) {
        console.error('Error updating password:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({ success: true, data })
    }
    
    // Fallback: prova con l'ID se non abbiamo l'email
    console.log('Trying to update by ID:', userId)
    const { data, error } = await adminClient.auth.admin.updateUserById(
      userId,
      { password }
    )
    
    if (error) {
      console.error('Error updating password by ID:', error)
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