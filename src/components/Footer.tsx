import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-white dark:bg-[#1a1b23] border-t border-gray-200 dark:border-gray-700 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Branding */}
          <div className="flex items-center gap-2">
            <img src="/logo-light.png" alt="MAIAT" className="w-6 h-6 object-contain" />
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100 font-mono">MAIAT</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Trust Layer for Agentic Commerce</span>
          </div>

          {/* Center: Links */}
          <div className="flex items-center gap-6 text-sm">
            <Link href="/docs" className="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
              API Docs
            </Link>
            <a href="https://t.me/MaiatBot" target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
              Telegram Bot
            </a>
            <a href="https://github.com/JhiNResH/maiat" target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
              GitHub
            </a>
          </div>

          {/* Right: Social */}
          <div className="flex items-center gap-4">
            <a 
              href="https://x.com/0xmaiat" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:opacity-80 transition-opacity text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              @0xmaiat
            </a>
          </div>
        </div>

        {/* Bottom: Copyright */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} Maiat. Built for ETHDenver 2026. All reviews are on-chain anchored.
          </p>
        </div>
      </div>
    </footer>
  )
}
