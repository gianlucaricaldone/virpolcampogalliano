'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'

export default function EconomiaPage() {
  const { profile, hasRole } = useAuth()
  const [loading, setLoading] = useState(false)

  // Check authorization after all hooks
  if (!hasRole('admin')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-red-500 mb-4">Accesso negato</p>
            <p className="text-gray-500">
              Solo gli amministratori possono accedere a questa sezione
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Economia</h1>
          <p className="mt-2 text-gray-600">
            Monitora entrate, uscite e bilancio della società
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Movimento
        </Button>
      </div>

      <Card className="text-center py-12">
        <CardContent>
          <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">
            Gestione economia in fase di sviluppo
          </p>
          <p className="text-sm text-gray-400">
            Qui potrai gestire bilanci, entrate, uscite e report finanziari
          </p>
        </CardContent>
      </Card>
    </div>
  )
}