'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Sparkles, Lock, Zap, TrendingUp, Users } from 'lucide-react'

interface Skill {
  id: string
  name: string
  icon: string
  creator: string
  creatorAvatar: string
  price: number | 'free'
  rating: number
  installs: number
  tags: string[]
  description: string
  featured?: boolean
}

const DOJO_SKILLS: Skill[] = [
  {
    id: 'web-search-pro',
    name: 'Web Search Pro',
    icon: '🔍',
    creator: 'Maiat Team',
    creatorAvatar: '🛡️',
    price: 'free',
    rating: 4.9,
    installs: 12540,
    tags: ['search', 'research', 'core'],
    description: 'Deep web search with real-time results and source verification',
    featured: true
  },
  {
    id: 'twitter-autopilot',
    name: 'Twitter Autopilot',
    icon: '🐦',
    creator: '0xAbove',
    creatorAvatar: '🤖',
    price: 100,
    rating: 4.7,
    installs: 3421,
    tags: ['social', 'automation', 'twitter'],
    description: 'Compose, schedule, and publish tweets with AI-driven content optimization'
  },
  {
    id: 'defi-navigator',
    name: 'DeFi Navigator',
    icon: '💰',
    creator: 'CryptoAlpha',
    creatorAvatar: '📊',
    price: 250,
    rating: 4.8,
    installs: 2156,
    tags: ['trading', 'defi', 'analysis'],
    description: 'Execute swaps, monitor yields, and optimize DeFi positions',
    featured: true
  },
  {
    id: 'security-scanner',
    name: 'Security Scanner',
    icon: '🛡️',
    creator: 'Trail of Bits',
    creatorAvatar: '🔐',
    price: 200,
    rating: 4.95,
    installs: 5432,
    tags: ['security', 'audit', 'contracts'],
    description: 'Automated smart contract and code security analysis'
  },
  {
    id: 'market-pulse',
    name: 'Market Pulse',
    icon: '📈',
    creator: 'Alpha Research',
    creatorAvatar: '📊',
    price: 150,
    rating: 4.6,
    installs: 2890,
    tags: ['research', 'market', 'analysis'],
    description: 'Real-time market sentiment and on-chain data analysis'
  },
  {
    id: 'content-crafter',
    name: 'Content Crafter',
    icon: '✍️',
    creator: 'WriterAI',
    creatorAvatar: '📝',
    price: 80,
    rating: 4.4,
    installs: 4123,
    tags: ['writing', 'creation', 'content'],
    description: 'Write, edit, and optimize content for any platform'
  },
  {
    id: 'api-orchestrator',
    name: 'API Orchestrator',
    icon: '🔗',
    creator: 'DevTools Inc',
    creatorAvatar: '⚙️',
    price: 300,
    rating: 4.7,
    installs: 1654,
    tags: ['integration', 'api', 'automation'],
    description: 'Connect to 1000+ APIs with custom workflows'
  },
  {
    id: 'conversation-genius',
    name: 'Conversation Genius',
    icon: '💬',
    creator: 'Maiat Team',
    creatorAvatar: '🛡️',
    price: 'free',
    rating: 4.8,
    installs: 18932,
    tags: ['chat', 'interaction', 'core'],
    description: 'Natural conversation with context awareness and memory'
  }
]

export default function DojoPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'featured' | 'rating' | 'installs' | 'new'>('featured')

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    DOJO_SKILLS.forEach((skill) => {
      skill.tags.forEach((tag) => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [])

  // Filter and sort skills
  const filteredSkills = useMemo(() => {
    let result = DOJO_SKILLS.filter((skill) => {
      const matchesSearch =
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.creator.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesTags =
        selectedTags.size === 0 || skill.tags.some((tag) => selectedTags.has(tag))

      return matchesSearch && matchesTags
    })

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating
        case 'installs':
          return b.installs - a.installs
        case 'new':
          return 0 // Would need createdAt timestamp
        case 'featured':
        default:
          return (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
      }
    })

    return result
  }, [searchQuery, selectedTags, sortBy])

  const toggleTag = (tag: string) => {
    const newTags = new Set(selectedTags)
    if (newTags.has(tag)) {
      newTags.delete(tag)
    } else {
      newTags.add(tag)
    }
    setSelectedTags(newTags)
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-color)] px-6 py-2 rounded-full text-xs font-bold tracking-widest uppercase mb-8">
              <Sparkles size={14} />
              The Skill Marketplace
            </div>

            <h1 className="atmosphere-text font-black text-[var(--text-color)] mb-4">
              The Dojo
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                Master Skills
              </span>
            </h1>

            <p className="text-[var(--text-secondary)] text-xl max-w-2xl mx-auto font-medium">
              Browse 100+ executable skills. Equip your agent, unlock potential, earn rewards.
            </p>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-3 gap-4 mb-12"
          >
            {[
              { icon: '📦', label: 'Skills Available', value: '147+' },
              { icon: '👥', label: 'Creators', value: '42' },
              { icon: '🚀', label: 'Total Installs', value: '50K+' }
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4 text-center"
              >
                <div className="text-2xl mb-2">{stat.icon}</div>
                <p className="text-[var(--text-muted)] text-xs font-bold uppercase tracking-widest mb-1">
                  {stat.label}
                </p>
                <p className="text-xl font-black text-[var(--text-color)]">{stat.value}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="px-6 mb-12 sticky top-0 z-40 bg-[var(--bg-color)]/80 backdrop-blur-xl py-4 border-b border-[var(--border-color)]">
        <div className="max-w-6xl mx-auto">
          {/* Search bar */}
          <div className="mb-6 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search skills, creators, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl pl-12 pr-6 py-3 text-[var(--text-color)] placeholder-[var(--text-muted)] focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
            />
          </div>

          {/* Tag filters */}
          <div className="flex gap-2 flex-wrap mb-4">
            {allTags.map((tag) => (
              <motion.button
                key={tag}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                  selectedTags.has(tag)
                    ? 'bg-purple-500 text-white ring-2 ring-purple-300'
                    : 'bg-[var(--card-bg)] text-[var(--text-color)] border border-[var(--border-color)] hover:border-purple-400'
                }`}
              >
                {tag}
              </motion.button>
            ))}
          </div>

          {/* Sort controls */}
          <div className="flex gap-2">
            {(['featured', 'rating', 'installs', 'new'] as const).map((option) => (
              <motion.button
                key={option}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSortBy(option)}
                className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all ${
                  sortBy === option
                    ? 'bg-purple-500 text-white'
                    : 'bg-[var(--card-bg)] text-[var(--text-color)] border border-[var(--border-color)] hover:border-purple-400'
                }`}
              >
                {option === 'featured' && <Sparkles size={14} className="inline mr-1" />}
                {option === 'rating' && <TrendingUp size={14} className="inline mr-1" />}
                {option === 'installs' && <Users size={14} className="inline mr-1" />}
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* Skills Grid */}
      <section className="px-6 pb-20">
        <div className="max-w-6xl mx-auto">
          {filteredSkills.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[var(--text-muted)] text-lg mb-2">No skills found</p>
              <p className="text-[var(--text-secondary)] text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSkills.map((skill, index) => (
                <motion.div
                  key={skill.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -4 }}
                  className="group bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 hover:border-purple-400 transition-all cursor-pointer"
                >
                  {/* Featured badge */}
                  {skill.featured && (
                    <div className="absolute -top-3 -right-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                      Featured
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-4xl">{skill.icon}</div>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400 text-sm font-bold">★</span>
                      <span className="text-[var(--text-color)] font-bold text-sm">{skill.rating}</span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-black text-[var(--text-color)] mb-1 group-hover:text-purple-400 transition-colors">
                    {skill.name}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mb-4 line-clamp-2">
                    {skill.description}
                  </p>

                  {/* Creator */}
                  <div className="flex items-center gap-2 mb-4 pb-4 border-b border-[var(--border-color)]">
                    <div className="text-lg">{skill.creatorAvatar}</div>
                    <div>
                      <p className="text-xs font-bold text-[var(--text-color)]">{skill.creator}</p>
                      <p className="text-xs text-[var(--text-muted)]">Creator</p>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex gap-1 flex-wrap mb-4">
                    {skill.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded font-bold"
                      >
                        {tag}
                      </span>
                    ))}
                    {skill.tags.length > 2 && (
                      <span className="text-xs text-[var(--text-muted)]">+{skill.tags.length - 2}</span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] mb-6">
                    <div className="flex items-center gap-1">
                      <Users size={12} />
                      {skill.installs.toLocaleString()}
                    </div>
                  </div>

                  {/* Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 ${
                      skill.price === 'free'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                        : 'bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30'
                    }`}
                  >
                    {skill.price === 'free' ? (
                      <>
                        <Zap size={14} /> Free
                      </>
                    ) : (
                      <>
                        <Lock size={14} /> {skill.price} SCARAB
                      </>
                    )}
                  </motion.button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-y border-[var(--border-color)]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-black text-[var(--text-color)] mb-4">
            Ready to Create Your Own Skill?
          </h2>
          <p className="text-[var(--text-secondary)] mb-8 font-medium">
            Package your knowledge into executable skills and earn from the community
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-12 py-4 rounded-2xl font-bold uppercase tracking-widest flex items-center gap-2 mx-auto hover:shadow-lg transition-shadow"
          >
            <Sparkles size={20} />
            Become a Sensei
          </motion.button>
        </div>
      </section>
    </div>
  )
}
