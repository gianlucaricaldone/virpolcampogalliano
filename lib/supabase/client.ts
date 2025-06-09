import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

export const createClient = () => {
  // Check if Supabase environment variables are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Create a proper chainable mock query builder
    const createMockQueryBuilder = () => {
      const mockBuilder = {
        select: () => mockBuilder,
        insert: () => mockBuilder,
        update: () => mockBuilder,
        delete: () => mockBuilder,
        eq: () => mockBuilder,
        neq: () => mockBuilder,
        gt: () => mockBuilder,
        gte: () => mockBuilder,
        lt: () => mockBuilder,
        lte: () => mockBuilder,
        like: () => mockBuilder,
        ilike: () => mockBuilder,
        is: () => mockBuilder,
        in: () => mockBuilder,
        contains: () => mockBuilder,
        containedBy: () => mockBuilder,
        rangeGt: () => mockBuilder,
        rangeGte: () => mockBuilder,
        rangeLt: () => mockBuilder,
        rangeLte: () => mockBuilder,
        rangeAdjacent: () => mockBuilder,
        overlaps: () => mockBuilder,
        textSearch: () => mockBuilder,
        match: () => mockBuilder,
        not: () => mockBuilder,
        or: () => mockBuilder,
        filter: () => mockBuilder,
        order: () => mockBuilder,
        limit: () => mockBuilder,
        range: () => mockBuilder,
        abortSignal: () => mockBuilder,
        single: () => mockBuilder,
        maybeSingle: () => mockBuilder,
        csv: () => mockBuilder,
        geojson: () => mockBuilder,
        explain: () => mockBuilder,
        rollback: () => mockBuilder,
        returns: () => mockBuilder,
        then: (resolve: any) => {
          // Always resolve with error indicating Supabase is not configured
          return Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }).then(resolve)
        },
        catch: (reject: any) => {
          return Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }).catch(reject)
        }
      }
      return mockBuilder
    }

    // Return a mock client with chainable query builder
    return {
      from: () => createMockQueryBuilder(),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        signIn: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
        signOut: () => Promise.resolve({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      },
      rpc: () => createMockQueryBuilder(),
      storage: {
        from: () => ({
          upload: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
          download: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
          remove: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
          list: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
          getPublicUrl: () => ({ data: { publicUrl: '' } })
        })
      }
    } as any
  }

  return createClientComponentClient<Database>()
}