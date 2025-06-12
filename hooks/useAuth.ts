'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { getSupabaseClient, getCachedQuery, setCachedQuery } from '@/lib/supabase/singleton'
import { Database } from '@/types/database'
import { useTestRole } from '@/contexts/TestRoleContext'

type UserProfile = Database['public']['Tables']['users']['Row']

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const supabase = getSupabaseClient()
  
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
          
          // Try to get cached profile first
          const cacheKey = `profile_${session.user.id}`
          const cachedProfile = getCachedQuery<UserProfile>(cacheKey)
          
          if (cachedProfile) {
            console.log('[useAuth] Using cached profile')
            setProfile(cachedProfile)
          } else {
            console.log('[useAuth] Fetching profile from DB...')
            
            // Get user profile from database
            const { data: profile, error: profileError } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single()
            
            console.log('[useAuth] Profile result:', { data: profile, error: profileError })
            
            if (profileError) {
              console.error('[useAuth] Profile error:', profileError)
            }
            
            if (profile) {
              // Cache the profile for 10 minutes
              setCachedQuery(cacheKey, profile, 10 * 60 * 1000)
            }
            
            setProfile(profile)
          }
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


  // console.log('useAuth return values:', { user, profile, loading })
  
  // Helper functions for role checking with fallback
  const hasRole = useCallback((role: string): boolean => {
    // Se esiste il campo roles (dopo migrazione), usalo
    if (profile?.roles && profile.roles.length > 0) {
      return profile.roles.includes(role as any)
    }
    // Altrimenti fallback al campo role singolo
    return profile?.role === role
  }, [profile?.roles, profile?.role])
  
  const hasAnyRole = useCallback((roles: string[]): boolean => {
    // Se esiste il campo roles (dopo migrazione), usalo
    if (profile?.roles && profile.roles.length > 0) {
      return roles.some(role => profile.roles.includes(role as any))
    }
    // Altrimenti fallback al campo role singolo
    return roles.includes(profile?.role as any)
  }, [profile?.roles, profile?.role])
  
  const signOut = useCallback(async () => {
    // Clear cached profile on sign out
    if (user?.id) {
      const cacheKey = `profile_${user.id}`
      setCachedQuery(cacheKey, null, 0) // Expire immediately
    }
    await supabase.auth.signOut()
  }, [supabase.auth, user?.id])
  
  // Use test role if admin is testing, otherwise use actual roles
  const currentRole = profile?.roles?.[0] === 'admin' && testRole ? testRole : profile?.role
  const currentRoles = profile?.roles || []
  
  // Memoize the profile object to prevent unnecessary re-renders
  const memoizedProfile = useMemo(() => {
    return profile ? { ...profile, role: currentRole } : null
  }, [profile, currentRole])
  
  // Memoize role checking functions to prevent re-creation
  const roleChecks = useMemo(() => ({
    isAdmin: hasRole('admin'),
    isDirigente: hasRole('dirigente'),
    isAllenatore: hasRole('allenatore'),
    isTesserato: hasRole('tesserato'),
    isGenitore: hasRole('genitore'),
  }), [hasRole])
  
  return {
    user,
    profile: memoizedProfile,
    loading,
    signOut,
    hasRole,
    hasAnyRole,
    roles: currentRoles,
    ...roleChecks,
  }
}