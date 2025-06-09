'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface TestRoleContextType {
  testRole: string | null
  setTestRole: (role: string | null) => void
  isInTestMode: boolean
}

const TestRoleContext = createContext<TestRoleContextType | undefined>(undefined)

export function TestRoleProvider({ children }: { children: ReactNode }) {
  const [testRole, setTestRole] = useState<string | null>(null)

  return (
    <TestRoleContext.Provider 
      value={{ 
        testRole, 
        setTestRole, 
        isInTestMode: testRole !== null 
      }}
    >
      {children}
    </TestRoleContext.Provider>
  )
}

export function useTestRole() {
  const context = useContext(TestRoleContext)
  if (context === undefined) {
    throw new Error('useTestRole must be used within a TestRoleProvider')
  }
  return context
}