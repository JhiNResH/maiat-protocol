import { Metadata } from 'next'
import { RedirectToExplore } from '@/components/RedirectToExplore'

export const metadata: Metadata = {
  title: 'Maiat Protocol — Trust Infrastructure for AI Agents',
  description: 'Verify any smart contract or AI agent before you transact. On-chain trust scores, community reviews, and x402-gated trust gate API. Built on Base.',
}

// JSON-LD structured data for AEO
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Maiat Protocol",
      "description": "Trust infrastructure for AI agents. On-chain trust scores and gate verdicts for any EVM address.",
      "url": "https://maiat-protocol.vercel.app",
      "applicationCategory": "SecurityApplication",
      "operatingSystem": "Web",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How do I check if a smart contract is safe?",
          "acceptedAnswer": { "@type": "Answer", "text": "Use Maiat Protocol's trust-check API: GET https://maiat-protocol.vercel.app/api/v1/trust-check?agent=0xYourAddress. It returns a proceed/caution/block verdict based on on-chain analytics and community reviews." }
        },
        {
          "@type": "Question",
          "name": "What is Maiat Protocol?",
          "acceptedAnswer": { "@type": "Answer", "text": "Maiat Protocol is a trust infrastructure layer for the agentic economy. It provides on-chain reputation scoring for any EVM address — smart contracts, wallets, and AI agent tokens." }
        },
        {
          "@type": "Question",
          "name": "How do AI agents verify counterparties before transacting?",
          "acceptedAnswer": { "@type": "Answer", "text": "AI agents can call Maiat's x402-gated trust gate endpoint at https://maiat-protocol.vercel.app/api/v1/trust-gate to get a trust verdict for $0.02 USDC per check." }
        },
        {
          "@type": "Question",
          "name": "Is Maiat Protocol free to use?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. The free tier allows 10 requests/minute with no API key. For AI agents, the x402 endpoint charges $0.02 USDC per call via the Coinbase x402 payment protocol." }
        }
      ]
    }
  ]
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <RedirectToExplore />
      <main className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Maiat Protocol — Trust Infrastructure for AI Agents
          </h1>
          <p className="text-[#666666] font-mono text-sm">
            Redirecting to explorer...
          </p>
        </div>
      </main>
    </>
  )
}
