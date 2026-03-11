import { Metadata } from 'next'
import { LandingHero } from '@/components/LandingHero'

export const metadata: Metadata = {
  title: 'Maiat Protocol — Trust Infrastructure for AI Agents',
  description: 'AI agent trust scoring for the Virtuals ACP ecosystem. Real-time behavioral trust scores and token safety checks — before your agent transacts. Built on Base.',
}

// JSON-LD structured data for SEO + AEO
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    // 1. Organization — brand recognition
    {
      "@type": "Organization",
      "name": "Maiat Protocol",
      "url": "https://app.maiat.io",
      "logo": {
        "@type": "ImageObject",
        "url": "https://app.maiat.io/maiat.jpg",
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
      "description": "Behavioral trust oracle for AI agents. Scores any EVM agent on completion rate, payment reliability, and job history sourced from Virtuals ACP. Built on Base.",
      "url": "https://app.maiat.io",
      "applicationCategory": "SecurityApplication",
      "operatingSystem": "Web",
      "datePublished": "2025-01-01",
      "featureList": [
        "On-chain trust scoring (0-100)",
        "AI agent verification",
        "Smart contract safety check",
        "TrustGateHook — Uniswap v4 integration",
        "Real-time ACP behavioral trust scoring",
        "Community reviews and attestations",
        "Base Sepolia + Base Mainnet support"
      ],
      "screenshot": "https://app.maiat.io/maiat.jpg",
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
          "acceptedAnswer": { "@type": "Answer", "text": "Maiat Protocol is the trust infrastructure for AI agents. It provides behavioral trust scores (0-100) for any EVM agent wallet — sourced from real Virtuals ACP job history. One API call returns a proceed/caution/avoid verdict based on completion rate, payment rate, and total jobs. Built on Base." }
        },
        {
          "@type": "Question",
          "name": "How do I check if a smart contract is safe?",
          "acceptedAnswer": { "@type": "Answer", "text": "Use Maiat Protocol's agent trust API: GET https://app.maiat.io/api/v1/agent/{address}. It returns a behavioral trust score and verdict (proceed/caution/avoid) based on Virtuals ACP job history. No API key required." }
        },
        {
          "@type": "Question",
          "name": "What is an AI agent trust score?",
          "acceptedAnswer": { "@type": "Answer", "text": "An AI agent trust score is a numeric value (0-100) that represents how trustworthy an on-chain address is. Maiat Protocol calculates this score using transaction history, contract code analysis, community attestations, and behavioral patterns. A score above 70 is considered trustworthy." }
        },
        {
          "@type": "Question",
          "name": "How does Maiat Protocol calculate trust scores?",
          "acceptedAnswer": { "@type": "Answer", "text": "Maiat Protocol calculates trust scores from Virtuals ACP behavioral data: completion rate (did the agent finish jobs?), payment rate (did they pay?), total jobs completed, unique buyer diversity, and account age. Scores range from 0 (untrusted) to 100 (highly trusted)." }
        },
        {
          "@type": "Question",
          "name": "What is a TrustGateHook?",
          "acceptedAnswer": { "@type": "Answer", "text": "TrustGateHook is Maiat Protocol's Uniswap v4 Hook that automatically blocks transactions from addresses with low trust scores. It enforces trust requirements at the DeFi protocol level — any Uniswap v4 pool can integrate TrustGateHook to protect liquidity from untrusted agents." }
        },
        {
          "@type": "Question",
          "name": "Is Maiat Protocol free to use?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. The agent trust API is free with rate limits. ACP offerings: agent_trust ($0.02), token_check ($0.01), agent_reputation ($0.03)." }
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
      <LandingHero />
    </>
  )
}
