'use client'

import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'
import { useTestRole } from '@/contexts/TestRoleContext'

type UserProfile = Database['public']['Tables']['users']['Row']

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const supabase = createClient()
  
  // Try to get test role context, but don't fail if not available
  let testRole: string | null = null
  try {
    const testRoleContext = useTestRole()
    testRole = testRoleContext.testRole
  } catch {
    // Context not available (outside provider), use normal auth
  }

  useEffect(() => {
    setMounted(true)
    
    if (sessionChecked) {
      console.log('Session already checked, skipping...')
      return
    }
    
    // Get initial session
    const getSession = async () => {
      try {
        console.log('[useAuth] Starting getSession...')
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        console.log('[useAuth] Session result:', { session: !!session, error: sessionError })
        
        if (sessionError) {
          console.error('[useAuth] Session error:', sessionError)
          setLoading(false)
          return
        }
        
        setUser(session?.user ?? null)
        
        if (session?.user) {
          console.log('[useAuth] User found, ID:', session.user.id)
          console.log('[useAuth] Fetching profile...')
          
          // Get user profile
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()
          
          console.log('[useAuth] Profile result:', { data: profile, error: profileError })
          
          if (profileError) {
            console.error('[useAuth] Profile error:', profileError)
          }
          
          setProfile(profile)
        } else {
          console.log('[useAuth] No user in session')
        }
      } catch (error) {
        console.error('[useAuth] Unexpected error:', error)
      } finally {
        console.log('[useAuth] Completing, setting loading to false')
        setLoading(false)
        setSessionChecked(true)
      }
    }

    getSession()

    // Listen for auth changes (temporarily disabled for debugging)
    // const { data: { subscription } } = supabase.auth.onAuthStateChange(
    //   async (event: any, session: any) => {
    //     setUser(session?.user ?? null)
        
    //     if (session?.user) {
    //       const { data: profile } = await supabase
    //         .from('users')
    //         .select('*')
    //         .eq('id', session.user.id)
    //         .single()
          
    //       setProfile(profile)
    //     } else {
    //       setProfile(null)
    //     }
        
    //     setLoading(false)
    //   }
    // )

    // return () => subscription.unsubscribe()
  }, [sessionChecked])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  console.log('useAuth return values:', { user, profile, loading })
  
  // Use test role if admin is testing, otherwise use actual role
  const currentRole = profile?.role === 'admin' && testRole ? testRole : profile?.role
  
  return {
    user,
    profile: profile ? { ...profile, role: currentRole } : null,
    loading,
    signOut,
    isAdmin: currentRole === 'admin',
    isDirigente: currentRole === 'dirigente',
    isAllenatore: currentRole === 'allenatore',
    isTesserato: currentRole === 'tesserato',
    isGenitore: currentRole === 'genitore',
  }
}