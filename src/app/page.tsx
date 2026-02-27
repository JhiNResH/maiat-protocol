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
          "acceptedAnswer": { "@type": "Answer", "text": "Maiat is the trust layer for the agent economy — one API call returns a trust score (0-10) for any on-chain address. Built on Base, powered by Chainlink CRE, enforced via Uniswap v4 Hooks." }
        }
      ]
    }
  ]
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <RedirectToExplore />
    </>
  )
}
