'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { PanelLeftOpen } from 'lucide-react'

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex min-h-[calc(100vh-65px)]">
      {/* Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

      {/* Expand button (shown when collapsed) */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="fixed left-4 top-[76px] z-50 p-2 bg-[#0c0c0e] border border-[#1f1f23] rounded-lg text-[#adadb0] hover:text-white hover:border-gold/40 transition-all shadow-lg"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}

      {/* Main content — shifts right to make room for sidebar */}
      <main
        className={`flex-1 min-w-0 transition-all duration-200 ease-in-out ${
          sidebarCollapsed ? 'ml-0' : 'md:ml-[240px]'
        }`}
      >
        {children}
      </main>
    </div>
  )
}
