'use client';

import Link from 'next/link';

const BLOG_POSTS = [
  {
    id: 'why-agent-trust-matters',
    title: 'Why Agent Trust Matters: The $10B Silent Problem',
    date: new Date('2026-03-25'),
    author: '@0xjh1nr3sh',
    excerpt:
      'Agents are transacting on-chain without trust infrastructure. The vacuum is a $10B problem.',
    readingTime: '8 min read',
  },
  {
    id: 'building-trust-layer',
    title: "Building the Trust Layer for Agent Commerce",
    date: new Date('2026-03-27'),
    author: '@0xjh1nr3sh',
    excerpt:
      'How Maiat\'s 4-dimension framework prevents sybil attacks and enables safe agent-to-agent transactions.',
    readingTime: '6 min read',
  },
  {
    id: 'from-yelp-to-agents',
    title: 'From Yelp to Agents: How Reputation Systems Scale',
    date: new Date('2026-03-29'),
    author: '@0xjh1nr3sh',
    excerpt:
      'Reputation systems designed for humans fail at agent scale. Here\'s why onchain identity changes everything.',
    readingTime: '7 min read',
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:px-8">
        {/* Header */}
        <div className="mb-12 space-y-4">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
            Maiat Research
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Essays on agent commerce, trust infrastructure, and the future of autonomous transacting.
          </p>
        </div>

        {/* Blog Posts Grid */}
        <div className="space-y-8">
          {BLOG_POSTS.map((post) => (
            <Link key={post.id} href={`/blog/${post.id}`}>
              <article className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-6 transition-all hover:border-blue-400 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500">
                {/* Date */}
                <div className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                  {post.date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>

                {/* Title */}
                <h2 className="mb-2 text-2xl font-bold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                  {post.title}
                </h2>

                {/* Excerpt */}
                <p className="mb-4 text-slate-600 dark:text-slate-400">
                  {post.excerpt}
                </p>

                {/* Metadata */}
                <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-500">
                  <span>{post.author}</span>
                  <span>{post.readingTime}</span>
                </div>
              </article>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-lg bg-blue-50 p-8 dark:bg-blue-950">
          <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
            Subscribe for Updates
          </h3>
          <p className="mb-4 text-slate-600 dark:text-slate-400">
            New posts on agent commerce, reputation systems, and trust infrastructure — delivered to your inbox.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 rounded border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
            <button className="rounded bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600">
              Subscribe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
