'use client'

import { useAuth } from '@/hooks/useAuth'

export default function DebugAuthPage() {
  const { user, profile, loading, hasRole } = useAuth()

  if (loading) {
    return <div>Loading auth state...</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Auth Status</h1>
      
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold">User:</h2>
          <pre className="bg-gray-100 p-2 rounded">
            {JSON.stringify(user ? { id: user.id, email: user.email } : null, null, 2)}
          </pre>
        </div>
        
        <div>
          <h2 className="font-semibold">Profile:</h2>
          <pre className="bg-gray-100 p-2 rounded">
            {JSON.stringify(profile, null, 2)}
          </pre>
        </div>
        
        <div>
          <h2 className="font-semibold">Role Checks:</h2>
          <ul className="list-disc list-inside">
            <li>Is Admin: {hasRole('admin') ? 'YES' : 'NO'}</li>
            <li>Is Dirigente: {hasRole('dirigente') ? 'YES' : 'NO'}</li>
            <li>Is Allenatore: {hasRole('allenatore') ? 'YES' : 'NO'}</li>
            <li>Is Tesserato: {hasRole('tesserato') ? 'YES' : 'NO'}</li>
          </ul>
        </div>
        
        <div>
          <h2 className="font-semibold">Can Access Users Page:</h2>
          <p className={hasRole('admin') ? 'text-green-600' : 'text-red-600'}>
            {hasRole('admin') ? 'YES - Admin access granted' : 'NO - Admin role required'}
          </p>
        </div>
        
        {hasRole('admin') && (
          <div>
            <h2 className="font-semibold">Navigation Link:</h2>
            <a href="/dashboard/admin/utenti" className="text-blue-600 underline">
              Go to Users Page
            </a>
          </div>
        )}
      </div>
    </div>
  )
}