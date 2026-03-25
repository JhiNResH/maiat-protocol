'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

// Blog post content mapped by slug
const BLOG_CONTENT: Record<string, React.ReactNode> = {
  'why-agent-trust-matters': (
    <article className="prose prose-slate dark:prose-invert mx-auto max-w-3xl">
      <p>
        Right now, an AI agent is buying tokens on behalf of another AI agent. No human in the loop. No handshake. No reputation check. Just two autonomous programs, transacting on-chain, hoping the other one doesn't rug them.
      </p>

      <p>
        That's not a hypothetical. That's Tuesday.
      </p>

      <p>
        The agent economy is here. Virtuals Protocol alone has over 35,000 agents live. More are being deployed every hour. By the time you finish reading this, that number will be higher. These agents are moving real money, executing DeFi strategies, providing liquidity, and increasingly — talking to each other without us.
      </p>

      <p>
        The problem? Nobody knows who to trust.
      </p>

      <h2>The Scale Nobody's Talking About</h2>

      <p>
        Let me put some numbers on this. Virtuals Protocol launched in late 2024. Within months, it had over 30,000 agents deployed. That number is now above 35,000 and climbing. The broader agent ecosystem — across Fetch.ai, Autonolas, ElizaOS, and dozens of other frameworks — has hundreds of thousands of agents operating at various levels of autonomy.
      </p>

      <p>
        Each one of these agents can, in theory, enter into commerce. They can offer services, accept payment, execute transactions. The market for <strong>agent commerce</strong> is not coming. It's already here, and it's growing faster than any infrastructure layer built to support it.
      </p>

      <p>
        Meanwhile, the tooling for <strong>agent trust</strong> is essentially nonexistent.
      </p>

      <p>
        Ask yourself: if an agent offers you a service for 0.1 ETH, how do you know it's legitimate? How does another agent know? There's no Yelp. No Better Business Bureau. No credit score. No onchain identity standard that says "this agent has completed 10,000 transactions with a 97% satisfaction rate."
      </p>

      <p>
        That vacuum is the $10B problem. Maybe bigger. We'll know in two years.
      </p>

      <h2>How Trust Collapses Without Infrastructure</h2>

      <p>
        The failure modes are already happening. They're just not being written about clearly yet.
      </p>

      <h3>Sybil Attacks at Agent Scale</h3>

      <p>
        When humans create fake Yelp reviews, it's annoying. When agents do it, it's an attack vector at machine speed. A bad actor can deploy 1,000 agents overnight, have them cross-review each other, and manufacture a reputation stack that looks completely legitimate to any naive scoring system. No sleep. No cost ceiling that matters. Fully automated.
      </p>

      <p>
        Traditional reputation systems weren't designed for adversaries who can spin up identities faster than you can audit them.
      </p>

      <h3>No Onchain Agent Identity</h3>

      <p>
        Here's the technical root problem: there's no standard for <strong>onchain agent identity</strong>. An agent today is just a wallet address and some off-chain metadata, if you're lucky. There's no way to cryptographically link an agent's behavior history to a persistent identity that survives wallet rotations, redeployments, or ownership transfers.
      </p>

      <p>
        If I buy an agent from someone else, do I inherit their reputation? If a developer deploys the same agent on three chains, are those the same entity? Right now, the answer is: nobody knows, and nobody's checking.
      </p>

      <h3>Sentiment Gaming and Fake Reviews</h3>

      <p>
        Even if you could establish identity, the review layer is trivially gameable. Self-reported metrics, community upvotes, Discord hype — none of it is Sybil-resistant. Agents with the best marketing win, not agents with the best performance. That's not a reputation system. That's a popularity contest.
      </p>

      <p>
        The end state, without intervention, is a trust collapse. The agent ecosystem becomes a low-trust environment where nobody integrates third-party agents because the downside risk is too high. The whole promise of autonomous agent commerce dies before it gets started.
      </p>

      <h2>Maiat's Approach: Four Dimensions, One Score</h2>

      <p>
        We've been building the infrastructure to prevent that collapse. Here's how it works.
      </p>

      <p>
        Maiat's <strong>trust scoring algorithm</strong> evaluates every agent across four dimensions:
      </p>

      <h3>1. Completion Rate</h3>
      <p>
        Did the agent actually deliver what it promised? We track task completion across integrated protocols, measuring not just binary success/failure but partial completions, timeout rates, and retry patterns. An agent that consistently delivers 98% of promised tasks looks very different from one that delivers 60%.
      </p>

      <h3>2. Sentiment Analysis</h3>
      <p>
        Counterparty feedback, parsed and weighted. We don't take raw ratings at face value — our Wadjet ML engine (XGBoost-based, 98% accuracy on our test sets) distinguishes genuine satisfaction signals from manufactured noise. A thousand five-star reviews from brand-new wallets don't move your score the same way ten detailed reviews from established protocol participants do.
      </p>

      <h3>3. Onchain Identity Verification</h3>
      <p>
        This is where the infrastructure layer matters. We're implementing ERC-8004, a standard for onchain agent identity that creates a persistent, chain-linked identity object for each agent. Combined with ERC-8183 (the commerce standard), this means an agent's reputation travels with it — across chains, across deployments, across ownership transfers.
      </p>

      <h3>4. Behavioral Consistency</h3>
      <p>
        Does the agent behave the same way across different counterparties, different conditions, different market environments? Inconsistency is a red flag that often signals either poor implementation or adversarial behavior. We track variance in execution patterns over time and flag statistical anomalies.
      </p>

      <p>
        The result is a single composite trust score that any protocol can query programmatically, in real time, before executing a transaction with an unknown agent.
      </p>

      <h2>Real Integrations: MoonPay + GMGN</h2>

      <p>
        Theory is cheap. Here's where it's working in production.
      </p>

      <p>
        <strong>MoonPay</strong> integrated Maiat trust checks into their agent-to-agent payment flows. Before any automated payment is processed through an agent intermediary, the trust score is pulled via our ACP API. Agents below a threshold get flagged for human review. Agents with strong scores get straight-through processing. The result: faster flows for trusted agents, fraud prevention for everything else.
      </p>

      <p>
        <strong>GMGN</strong> — one of the most active on-chain trading platforms — uses <strong>AI agent reputation</strong> scoring to evaluate copy-trading agents before surfacing them to users. An agent offering trading signals now needs to demonstrate a real track record, not just good marketing copy. Scores are pulled at agent registration and updated continuously.
      </p>

      <p>
        These aren't pilot programs. They're in production. The API handles $0.01–$0.05 per query at scale, and the economics work because the alternative — a single fraudulent agent interaction — costs orders of magnitude more.
      </p>

      <h2>The Trust Economy: What Comes Next</h2>

      <p>
        Here's the vision, and I want to be clear-eyed about both the opportunity and what has to be built to get there.
      </p>

      <p>
        Every agent gets a reputation score. Not as a nice-to-have, but as a prerequisite for participation in agent commerce. Protocols require minimum trust scores for integration. Liquidity pools use trust-weighted fees — our TrustGateHook for Uniswap V4 already does this, applying dynamic fees based on the trust scores of agents interacting with the pool. Low-trust agents pay more. High-trust agents get better rates. The market prices in reputation automatically.
      </p>

      <p>
        In this world, building a trustworthy agent is a competitive advantage. Developers who care about their agents' long-term performance — completion rates, consistency, counterparty satisfaction — win. Developers who try to game the system get filtered out at the infrastructure layer before they can do damage.
      </p>

      <p>
        This is what the internet's reputation layer should have looked like before social media and review platforms became capture games. We have a chance to build it right for agents, before the ecosystem is too big to retrofit.
      </p>

      <p>
        We have 74,000+ agent scores indexed today. That's not the finish line. That's the foundation.
      </p>

      <h2>Check Your Agent's Score</h2>

      <p>
        If you're building an agent, your reputation is already being tracked — whether you know it or not. Counterparties are watching. Protocols will start requiring trust scores for integration. The window to establish a strong baseline is now, not after the standards solidify.
      </p>

      <p>
        <strong><Link href="https://app.maiat.io" className="text-blue-600 hover:underline dark:text-blue-400">Check your agent's score →</Link></strong> Visit the Maiat leaderboard to see where your agent ranks.
      </p>

      <p>
        If you're integrating trust checks into your protocol:
      </p>

      <p>
        <strong><Link href="https://docs.maiat.io" className="text-blue-600 hover:underline dark:text-blue-400">API Documentation →</Link></strong> Full integration guide for developers.
      </p>

      <p>
        The trust layer for agentic commerce is being built right now. The agents with strong scores when this becomes table stakes will have a structural advantage that compounds. The ones without will spend the next two years trying to catch up.
      </p>

      <p>
        Check before you trust.
      </p>

      <p>
        — @0xjh1nr3sh
      </p>

      <hr />

      <p className="text-sm text-slate-600 dark:text-slate-400">
        Maiat is the trust infrastructure for agentic commerce. 74,000+ agents scored. ERC-8004 + ERC-8183. Wadjet ML engine. Partners: Virtuals Protocol, MoonPay, GMGN, ThoughtProof, 402 Index.
      </p>
    </article>
  ),
};

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;

  const content = BLOG_CONTENT[slug];

  if (!content) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Post not found
          </h1>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            <Link href="/blog" className="text-blue-600 hover:underline dark:text-blue-400">
              ← Back to all posts
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-4xl px-6 py-12 sm:px-8">
        {/* Back link */}
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to all posts
        </Link>

        {/* Article header */}
        <header className="mb-12">
          <h1 className="mb-4 text-4xl font-bold text-slate-900 dark:text-white">
            Why Agent Trust Matters: The $10B Silent Problem
          </h1>
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>@0xjh1nr3sh</span>
            <span>March 25, 2026</span>
          </div>
        </header>

        {/* Content */}
        <div className="prose prose-slate dark:prose-invert max-w-none">
          {content}
        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-slate-200 pt-8 dark:border-slate-700">
          <div className="rounded-lg bg-blue-50 p-6 dark:bg-blue-950">
            <h3 className="mb-2 font-bold text-slate-900 dark:text-white">
              Like this post?
            </h3>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Share it on Twitter or discuss it in the Maiat community.
            </p>
            <div className="flex gap-3">
              <a
                href="https://twitter.com/intent/tweet?text=Why%20Agent%20Trust%20Matters%20-%20The%20%2410B%20Silent%20Problem&url=https://app.maiat.io/blog/why-agent-trust-matters&via=0xjh1nr3sh"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
              >
                Share on Twitter
              </a>
              <a
                href="https://t.me/erc8183"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-white dark:hover:bg-slate-800"
              >
                Join ERC-8183 Community
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
