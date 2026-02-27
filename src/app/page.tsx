import { Metadata } from 'next'
import { RedirectToExplore } from '@/components/RedirectToExplore'

export const metadata: Metadata = {
  title: 'Maiat Protocol — Trust Infrastructure for AI Agents',
  description: 'Verify any smart contract or AI agent before you transact. On-chain trust scores, community reviews, and x402-gated trust gate API. Built on Base.',
}

// JSON-LD structured data for SEO + AEO
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    // 1. Organization — brand recognition
    {
      "@type": "Organization",
      "name": "Maiat Protocol",
      "url": "https://maiat-protocol.vercel.app",
      "logo": {
        "@type": "ImageObject",
        "url": "https://maiat-protocol.vercel.app/maiat.jpg",
        "width": 1200,
        "height": 630
      },
      "description": "Trust infrastructure for the agent economy. On-chain trust scores and verification for AI agents and smart contracts.",
      "sameAs": [
        "https://twitter.com/0xmaiat",
        "https://github.com/JhiNResH/maiat-protocol"
      ]
    },
    // 2. SoftwareApplication — enhanced
    {
      "@type": "SoftwareApplication",
      "name": "Maiat Protocol",
      "description": "Trust infrastructure for AI agents. On-chain trust scores and gate verdicts for any EVM address. Built on Base, powered by Chainlink, enforced via Uniswap v4 Hooks.",
      "url": "https://maiat-protocol.vercel.app",
      "applicationCategory": "SecurityApplication",
      "operatingSystem": "Web",
      "datePublished": "2025-01-01",
      "featureList": [
        "On-chain trust scoring (0-100)",
        "AI agent verification",
        "Smart contract safety check",
        "TrustGateHook — Uniswap v4 integration",
        "x402 payment-gated trust API",
        "Community reviews and attestations",
        "Base Sepolia + Base Mainnet support"
      ],
      "screenshot": "https://maiat-protocol.vercel.app/maiat.jpg",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free tier available. API access from $0.01 per query."
      },
      "publisher": {
        "@type": "Organization",
        "name": "Maiat Protocol"
      }
    },
    // 3. FAQPage — expanded with real search queries
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is Maiat Protocol?",
          "acceptedAnswer": { "@type": "Answer", "text": "Maiat Protocol is the trust layer for the agent economy. It provides on-chain trust scores (0-100) for any EVM address — AI agents, smart contracts, or wallets. One API call returns a proceed/caution/block verdict based on on-chain analytics, transaction history, and community reviews. Built on Base." }
        },
        {
          "@type": "Question",
          "name": "How do I check if a smart contract is safe?",
          "acceptedAnswer": { "@type": "Answer", "text": "Use Maiat Protocol's trust-check API: GET https://maiat-protocol.vercel.app/api/v1/trust-check?agent=0xYourAddress. It returns a trust score and verdict (proceed/caution/block) based on on-chain analytics and community reviews. No API key required for the free tier." }
        },
        {
          "@type": "Question",
          "name": "What is an AI agent trust score?",
          "acceptedAnswer": { "@type": "Answer", "text": "An AI agent trust score is a numeric value (0-100) that represents how trustworthy an on-chain address is. Maiat Protocol calculates this score using transaction history, contract code analysis, community attestations, and behavioral patterns. A score above 70 is considered trustworthy." }
        },
        {
          "@type": "Question",
          "name": "How does Maiat Protocol calculate trust scores?",
          "acceptedAnswer": { "@type": "Answer", "text": "Maiat Protocol calculates trust scores using multiple signals: on-chain transaction history, contract verification status, age of the address, community reviews, interaction patterns with known protocols, and Chainlink CRE oracle data. Scores range from 0 (untrusted) to 100 (highly trusted)." }
        },
        {
          "@type": "Question",
          "name": "What is a TrustGateHook?",
          "acceptedAnswer": { "@type": "Answer", "text": "TrustGateHook is Maiat Protocol's Uniswap v4 Hook that automatically blocks transactions from addresses with low trust scores. It enforces trust requirements at the DeFi protocol level — any Uniswap v4 pool can integrate TrustGateHook to protect liquidity from untrusted agents." }
        },
        {
          "@type": "Question",
          "name": "Is Maiat Protocol free to use?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. Maiat Protocol offers a free tier for basic trust score queries. Advanced API features start at $0.01 per query via x402 payment protocol. The TrustGateHook integration is open source and free to deploy." }
        },
        {
          "@type": "Question",
          "name": "What blockchain networks does Maiat Protocol support?",
          "acceptedAnswer": { "@type": "Answer", "text": "Maiat Protocol is built on Base (Coinbase's L2 on Ethereum). It supports Base Mainnet and Base Sepolia testnet. Trust score data is aggregated from Ethereum mainnet, Base, and BNB Chain transaction history." }
        },
        {
          "@type": "Question",
          "name": "How can AI agents use Maiat Protocol?",
          "acceptedAnswer": { "@type": "Answer", "text": "AI agents can integrate Maiat Protocol via the REST API or the maiat-viem-guard SDK. Before executing any on-chain transaction, the agent queries Maiat to get a trust score for the counterparty. If the score is below the threshold, the transaction is blocked. This enables zero-trust agent-to-agent commerce." }
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
