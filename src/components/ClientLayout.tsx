'use client'

import { Sidebar } from './Sidebar'

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-65px)]">
      <Sidebar />
      <main className="flex-1 min-w-0 lg:ml-[240px]">
        {children}
      </main>
    </div>
  )
}
