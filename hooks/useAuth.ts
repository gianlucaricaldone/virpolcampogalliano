'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import { getSupabaseClient, getCachedQuery, setCachedQuery, getCachedAuthState, setCachedAuthState, clearCachedAuthState } from '@/lib/supabase/singleton'
import { Database } from '@/types/database'
import { useTestRole } from '@/contexts/TestRoleContext'

type UserProfile = Database['public']['Tables']['users']['Row']
type UserRole = Database['public']['Enums']['user_role']

interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  error: Error | null
}

interface UseAuthReturn extends AuthState {
  signOut: () => Promise<void>
  hasRole: (role: string) => boolean
  hasAnyRole: (roles: string[]) => boolean
  roles: UserRole[]
  isAdmin: boolean
  isDirigente: boolean
  isAllenatore: boolean
  isTesserato: boolean
  isGenitore: boolean
}

const PROFILE_CACHE_DURATION = 30 * 60 * 1000 // 30 minutes - extended for dashboard

/**
 * Custom hook for authentication and user profile management
 * Handles auth state, profile fetching, role checking, and caching
 */
export function useAuth(): UseAuthReturn {
  // Check for cached auth state first
  const cachedAuth = getCachedAuthState()
  
  const [authState, setAuthState] = useState<AuthState>({
    user: cachedAuth?.user || null,
    profile: cachedAuth?.profile || null,
    loading: !cachedAuth, // Only loading if no cache
    error: null
  })
  
  const sessionCheckedRef = useRef(false)
  const mountedRef = useRef(false)
  const supabase = getSupabaseClient()
  
  // Get test role context if available
  const testRole = useTestRoleContext()

  /**
   * Fetches user profile from database with caching and deduplication
   */
  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    const cacheKey = `profile_${userId}`
    
    // Check cache first
    const cachedProfile = getCachedQuery<UserProfile>(cacheKey)
    if (cachedProfile) {
      console.log('[useAuth] Using cached profile for user:', userId.substring(0, 8))
      return cachedProfile
    }
    
    // Check if there's already an ongoing fetch for this user
    const fetchKey = `fetching_${userId}`
    const ongoingFetch = getCachedQuery<Promise<UserProfile | null>>(fetchKey)
    if (ongoingFetch) {
      console.log('[useAuth] Waiting for ongoing fetch for user:', userId.substring(0, 8))
      return ongoingFetch
    }
    
    console.log('[useAuth] Fetching profile from DB for user:', userId.substring(0, 8))
    
    // Create and cache the fetch promise to prevent duplicates
    const fetchPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()
        
        if (error) {
          console.error('[useAuth] Profile fetch error:', error)
          throw error
        }
        
        if (data) {
          // Cache the profile
          setCachedQuery(cacheKey, data, PROFILE_CACHE_DURATION)
          console.log('[useAuth] Profile cached for user:', userId.substring(0, 8))
        }
        
        return data
      } catch (error) {
        console.error('[useAuth] Error fetching profile:', error)
        return null
      } finally {
        // Clear the ongoing fetch marker
        setCachedQuery(fetchKey, null, 0)
      }
    })()
    
    // Cache the promise briefly to prevent duplicate requests
    setCachedQuery(fetchKey, fetchPromise, 5000) // 5 seconds
    
    return fetchPromise
  }, [supabase])

  /**
   * Handles auth state changes
   */
  const handleAuthStateChange = useCallback(async (event: AuthChangeEvent, session: Session | null) => {
    console.log('[useAuth] Auth state changed:', event, session?.user?.id)
    
    if (!mountedRef.current) return
    
    const user = session?.user ?? null
    
    setAuthState(prev => ({ ...prev, user, loading: true }))
    
    if (user) {
      try {
        const profile = await fetchUserProfile(user.id)
        if (mountedRef.current) {
          // Cache the auth state
          setCachedAuthState(user, profile)
          
          setAuthState(prev => ({ 
            ...prev, 
            profile, 
            loading: false,
            error: null 
          }))
        }
      } catch (error) {
        if (mountedRef.current) {
          setAuthState(prev => ({ 
            ...prev, 
            profile: null, 
            loading: false,
            error: error instanceof Error ? error : new Error('Failed to fetch profile')
          }))
        }
      }
    } else {
      // Clear cache when no user
      clearCachedAuthState()
      
      setAuthState(prev => ({ 
        ...prev, 
        profile: null, 
        loading: false,
        error: null 
      }))
    }
  }, [fetchUserProfile])

  /**
   * Initializes auth state on mount
   */
  useEffect(() => {
    mountedRef.current = true
    
    const initAuth = async () => {
      try {
        console.log('[useAuth] Getting session...')
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          throw error
        }
        
        console.log('[useAuth] Initial session:', session?.user?.id ? 'found' : 'none')
        
        // Handle session directly without triggering auth change handler
        const user = session?.user ?? null
        setAuthState(prev => ({ ...prev, user, loading: user ? true : false }))
        
        if (user) {
          try {
            const profile = await fetchUserProfile(user.id)
            if (mountedRef.current) {
              setCachedAuthState(user, profile)
              setAuthState(prev => ({ 
                ...prev, 
                profile, 
                loading: false,
                error: null 
              }))
            }
          } catch (error) {
            if (mountedRef.current) {
              setAuthState(prev => ({ 
                ...prev, 
                profile: null, 
                loading: false,
                error: error instanceof Error ? error : new Error('Failed to fetch profile')
              }))
            }
          }
        } else {
          clearCachedAuthState()
          setAuthState(prev => ({ 
            ...prev, 
            profile: null, 
            loading: false,
            error: null 
          }))
        }
        
      } catch (error) {
        console.error('[useAuth] Init error:', error)
        setAuthState(prev => ({ 
          ...prev, 
          loading: false,
          error: error instanceof Error ? error : new Error('Failed to initialize auth')
        }))
      }
    }
    
    // Always initialize auth to validate current session
    if (!sessionCheckedRef.current) {
      sessionCheckedRef.current = true
      initAuth()
    }
    
    // Subscribe to auth changes (only for future changes, not initial)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      // Only handle changes after initial load and avoid duplicate processing
      if (sessionCheckedRef.current && event !== 'INITIAL_SESSION') {
        console.log('[useAuth] Auth change event:', event, 'for user:', session?.user?.id?.substring(0, 8) || 'none')
        handleAuthStateChange(event, session)
      }
    })
    
    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, []) // Remove dependencies to prevent re-running

  /**
   * Signs out the current user
   */
  const signOut = useCallback(async () => {
    if (authState.user?.id) {
      const cacheKey = `profile_${authState.user.id}`
      setCachedQuery(cacheKey, null, 0)
    }
    clearCachedAuthState()
    await supabase.auth.signOut()
  }, [supabase.auth, authState.user?.id])

  /**
   * Checks if user has a specific role
   */
  const hasRole = useCallback((role: string): boolean => {
    const { profile } = authState
    if (!profile) return false
    
    // Support both 'roles' array and legacy 'role' field
    if (profile.roles && profile.roles.length > 0) {
      return profile.roles.includes(role as UserRole)
    }
    return profile.role === role
  }, [authState.profile])

  /**
   * Checks if user has any of the specified roles
   */
  const hasAnyRole = useCallback((roles: string[]): boolean => {
    const { profile } = authState
    if (!profile) return false
    
    if (profile.roles && profile.roles.length > 0) {
      return roles.some(role => profile.roles!.includes(role as UserRole))
    }
    return roles.includes(profile.role!)
  }, [authState.profile])

  // Get current role(s) considering test role for admins
  const effectiveRole = useMemo(() => {
    const { profile } = authState
    if (!profile) return null
    
    // If admin is testing a role, use that
    if (profile.roles?.[0] === 'admin' && testRole) {
      return testRole
    }
    
    return profile.role
  }, [authState.profile, testRole])

  const effectiveRoles = useMemo(() => {
    const { profile } = authState
    return profile?.roles || []
  }, [authState.profile])

  // Memoize role checks
  const roleChecks = useMemo(() => ({
    isAdmin: hasRole('admin'),
    isDirigente: hasRole('dirigente'),
    isAllenatore: hasRole('allenatore'),
    isTesserato: hasRole('tesserato'),
    isGenitore: hasRole('genitore'),
  }), [hasRole])

  // Prepare final profile with effective role
  const profileWithEffectiveRole = useMemo(() => {
    if (!authState.profile) return null
    return { 
      ...authState.profile, 
      role: (effectiveRole as UserRole) || authState.profile.role 
    }
  }, [authState.profile, effectiveRole])

  return {
    ...authState,
    profile: profileWithEffectiveRole,
    signOut,
    hasRole,
    hasAnyRole,
    roles: effectiveRoles,
    ...roleChecks,
  }
}

/**
 * Helper hook to safely get test role context
 */
function useTestRoleContext(): string | null {
  try {
    const { testRole } = useTestRole()
    return testRole
  } catch {
    // Context not available, return null
    return null
  }
}