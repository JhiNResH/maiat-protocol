'use client'

import Link from 'next/link'
import { useState } from 'react'

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(6, 7, 16, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-center justify-between px-6 md:px-10 h-16 max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--gold)', boxShadow: '0 0 12px rgba(212,160,23,0.3)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="#060710" strokeWidth="1.5" fill="none"/>
              <circle cx="7" cy="7" r="2" fill="#060710"/>
            </svg>
          </div>
          <span
            className="font-mono text-[15px] font-bold tracking-[4px] uppercase"
            style={{ color: 'var(--text-primary)' }}
          >
            Maiat
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {[
            { label: 'Explore', href: 'https://maiat-protocol.vercel.app/explore' },
            { label: 'API Docs', href: 'https://maiat-protocol.vercel.app/docs' },
            { label: 'GitHub', href: 'https://github.com/JhiNResH/maiat' },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold"
            style={{
              border: '1px solid rgba(0, 201, 167, 0.3)',
              color: 'var(--teal)',
              background: 'rgba(0, 201, 167, 0.05)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{
                background: 'var(--teal)',
                animation: 'pulse-gold 2s ease infinite',
                boxShadow: '0 0 6px var(--teal)',
              }}
            />
            Base Sepolia Live
          </div>
          <Link href="https://maiat-protocol.vercel.app/explore" className="btn-primary text-sm">
            Launch App
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            {mobileOpen
              ? <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
              : <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
            }
          </svg>
        </button>
      </div>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div
          className="md:hidden px-6 pb-4 flex flex-col gap-1"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          {[
            { label: 'Explore', href: 'https://maiat-protocol.vercel.app/explore' },
            { label: 'API Docs', href: 'https://maiat-protocol.vercel.app/docs' },
            { label: 'GitHub', href: 'https://github.com/JhiNResH/maiat' },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="py-3 text-sm font-medium"
              style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
            >
              {item.label}
            </Link>
          ))}
          <Link href="https://maiat-protocol.vercel.app/explore" className="btn-primary mt-3 justify-center">
            Launch App
          </Link>
        </div>
      )}
    </header>
  )
}
