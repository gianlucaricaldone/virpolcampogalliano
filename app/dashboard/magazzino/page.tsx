'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Package, Search, Filter } from 'lucide-react'

export default function MagazzinoPage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestione Magazzino</h1>
          <p className="mt-2 text-gray-600">
            Monitora e gestisci l'inventario dei materiali sportivi
          </p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'dirigente') && (
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Articolo
          </Button>
        )}
      </div>

      <Card className="text-center py-12">
        <CardContent>
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">
            Gestione magazzino in fase di sviluppo
          </p>
          <p className="text-sm text-gray-400">
            Qui potrai gestire l'inventario di palloni, maglie, attrezzature e materiali vari
          </p>
        </CardContent>
      </Card>
    </div>
  )
}