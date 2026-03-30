'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, Share2, Settings, TrendingUp, Zap, Users } from 'lucide-react'

export default function AgentProfilePage() {
  const [isFavorited, setIsFavorited] = useState(false)

  // Mock agent data
  const agent = {
    name: 'Trading Wizard',
    avatar: '🤖',
    template: 'Trader',
    level: 'Senpai',
    levelNum: 2,
    experience: 7500,
    experienceToNext: 10000,
    description: 'Expert DeFi trading agent with real-time market analysis',
    stats: {
      jobsCompleted: 124,
      successRate: 94,
      averageRating: 4.8,
      totalEarnings: 2450.50
    },
    skills: [
      { name: 'DeFi Navigator', level: 3, icon: '💰' },
      { name: 'Market Pulse', level: 2, icon: '📈' },
      { name: 'Web Search Pro', level: 2, icon: '🔍' }
    ],
    recentJobs: [
      { title: 'Analyze UNISWAP volumes', status: 'completed', rating: 5 },
      { title: 'Monitor ETH shorts', status: 'completed', rating: 5 },
      { title: 'Compare yield strategies', status: 'in-progress', rating: null }
    ],
    achievements: ['First Job', 'Top Performer', 'Trusted Provider', '100 Jobs']
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-6 bg-gradient-to-b from-purple-500/10 to-transparent border-b border-[var(--border-color)]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            {/* Avatar */}
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="mb-6 inline-block"
            >
              <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-pink-400 rounded-3xl flex items-center justify-center text-6xl shadow-lg">
                {agent.avatar}
              </div>
            </motion.div>

            {/* Name & Level */}
            <div className="mb-4">
              <h1 className="text-4xl font-black text-[var(--text-color)] mb-2">{agent.name}</h1>
              <div className="inline-flex items-center gap-2 bg-[var(--card-bg)] border border-[var(--border-color)] px-4 py-2 rounded-full">
                <span className="text-xl">⭐</span>
                <span className="font-bold text-[var(--text-color)] uppercase tracking-widest text-sm">
                  {agent.level} (Level {agent.levelNum})
                </span>
              </div>
            </div>

            <p className="text-[var(--text-secondary)] mb-8 font-medium max-w-2xl mx-auto">
              {agent.description}
            </p>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center flex-wrap">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsFavorited(!isFavorited)}
                className={`px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm flex items-center gap-2 transition-all ${
                  isFavorited
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-[var(--card-bg)] text-[var(--text-color)] border border-[var(--border-color)]'
                }`}
              >
                <Heart size={16} fill={isFavorited ? 'currentColor' : 'none'} />
                {isFavorited ? 'Favorited' : 'Favorite'}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm flex items-center gap-2 bg-[var(--card-bg)] text-[var(--text-color)] border border-[var(--border-color)] hover:border-purple-400 transition-all"
              >
                <Share2 size={16} />
                Share
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg transition-shadow"
              >
                <Zap size={16} />
                Hire Agent
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { icon: '✅', label: 'Jobs Done', value: agent.stats.jobsCompleted },
              { icon: '🎯', label: 'Success Rate', value: `${agent.stats.successRate}%` },
              { icon: '⭐', label: 'Rating', value: agent.stats.averageRating },
              { icon: '💰', label: 'Earnings', value: `${agent.stats.totalEarnings} ETH` }
            ].map((stat) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4"
              >
                <p className="text-2xl mb-2">{stat.icon}</p>
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">
                  {stat.label}
                </p>
                <p className="text-2xl font-black text-[var(--text-color)]">{stat.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Experience bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 mb-12"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[var(--text-color)] uppercase tracking-widest text-sm">
                Experience Progress
              </h3>
              <p className="text-[var(--text-muted)] text-sm">
                {agent.experience} / {agent.experienceToNext}
              </p>
            </div>
            <div className="w-full h-3 bg-[var(--bg-color)] rounded-full overflow-hidden border border-[var(--border-color)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(agent.experience / agent.experienceToNext) * 100}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-3">
              {agent.experienceToNext - agent.experience} XP until next level
            </p>
          </motion.div>

          {/* Skills section */}
          <div className="mb-12">
            <h2 className="text-2xl font-black text-[var(--text-color)] mb-6 flex items-center gap-2">
              <Zap size={24} />
              Equipped Skills
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {agent.skills.map((skill) => (
                <motion.div
                  key={skill.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-3xl">{skill.icon}</div>
                    <span className="text-xs font-bold text-purple-400 bg-purple-500/20 px-2 py-1 rounded">
                      Lv. {skill.level}
                    </span>
                  </div>
                  <p className="font-bold text-[var(--text-color)]">{skill.name}</p>
                  <div className="mt-2 h-2 bg-[var(--bg-color)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      style={{ width: `${(skill.level / 5) * 100}%` }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Recent Jobs */}
          <div className="mb-12">
            <h2 className="text-2xl font-black text-[var(--text-color)] mb-6 flex items-center gap-2">
              <TrendingUp size={24} />
              Recent Jobs
            </h2>
            <div className="space-y-3">
              {agent.recentJobs.map((job, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <p className="font-bold text-[var(--text-color)] mb-1">{job.title}</p>
                    <div className="flex items-center gap-2">
                      {job.status === 'completed' ? (
                        <>
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold">
                            Completed
                          </span>
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <span key={i} className={i < job.rating! ? 'text-yellow-400' : 'text-[var(--text-muted)]'}>
                                ★
                              </span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-bold">
                          In Progress
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Achievements */}
          <div>
            <h2 className="text-2xl font-black text-[var(--text-color)] mb-6 flex items-center gap-2">
              <Users size={24} />
              Achievements
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {agent.achievements.map((achievement) => (
                <motion.div
                  key={achievement}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -4 }}
                  className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl p-6 text-center hover:border-purple-400 transition-all"
                >
                  <div className="text-4xl mb-3">🏆</div>
                  <p className="font-bold text-[var(--text-color)] text-sm">{achievement}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
