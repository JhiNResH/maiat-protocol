'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { PanelLeftOpen } from 'lucide-react'

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex flex-1 pt-0">
      {/* Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

      {/* Expand Button (when sidebar collapsed) */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="fixed left-4 top-[80px] z-40 p-2 bg-[#111113] border border-[#1f1f23] rounded-lg text-white hover:border-purple-500 transition-colors shadow-lg"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
      )}

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'ml-0' : 'md:ml-[260px]'
        }`}
      >
        {children}
      </main>
    </div>
  )
}
