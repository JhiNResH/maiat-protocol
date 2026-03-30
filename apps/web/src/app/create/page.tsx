'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Upload, Zap, Shield, Sparkles, Loader2, CheckCircle2 } from 'lucide-react'
import type { Agent } from '@/lib/types'

type CreateStep = 'login' | 'details' | 'skills' | 'review' | 'success'

const AGENT_TEMPLATES = [
  {
    id: 'assistant',
    name: 'Personal Assistant',
    icon: '🤖',
    description: 'General-purpose helper for daily tasks',
    color: 'from-blue-400 to-blue-600'
  },
  {
    id: 'trader',
    name: 'Trading Agent',
    icon: '📈',
    description: 'DeFi trading and market analysis',
    color: 'from-green-400 to-green-600'
  },
  {
    id: 'researcher',
    name: 'Researcher',
    icon: '🔍',
    description: 'In-depth research and analysis',
    color: 'from-purple-400 to-purple-600'
  },
  {
    id: 'creator',
    name: 'Content Creator',
    icon: '✍️',
    description: 'Content writing and social media',
    color: 'from-pink-400 to-pink-600'
  },
  {
    id: 'auditor',
    name: 'Security Auditor',
    icon: '🔐',
    description: 'Smart contract and code review',
    color: 'from-red-400 to-red-600'
  },
  {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    description: 'Define your own agent behavior',
    color: 'from-gray-400 to-gray-600'
  }
]

const FREE_SKILLS = [
  { id: 'web-search', name: 'Web Search', icon: '🔍', tags: ['info', 'research'] },
  { id: 'chat', name: 'Conversation', icon: '💬', tags: ['core', 'interaction'] },
  { id: 'data-analysis', name: 'Data Analysis', icon: '📊', tags: ['analysis', 'research'] },
  { id: 'content-write', name: 'Content Writing', icon: '📝', tags: ['creation', 'writing'] }
]

const PRO_SKILLS = [
  { id: 'twitter', name: 'Twitter Automation', icon: '🐦', price: 100, tags: ['social', 'automation'] },
  { id: 'defi-trade', name: 'DeFi Trading', icon: '💰', price: 250, tags: ['trading', 'defi'] },
  { id: 'security-audit', name: 'Security Auditing', icon: '🛡️', price: 200, tags: ['security', 'audit'] },
  { id: 'market-research', name: 'Market Research', icon: '📈', price: 150, tags: ['research', 'market'] },
  { id: 'api-integration', name: 'Custom API', icon: '🔗', price: 300, tags: ['integration', 'api'] }
]

export default function CreateAgentPage() {
  const router = useRouter()
  const { authenticated, user, login, logout } = usePrivy()
  const { wallets } = useWallets()
  const [step, setStep] = useState<CreateStep>('login')

  // Form state
  const [agentName, setAgentName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set(['web-search', 'chat']))
  const [description, setDescription] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-advance to details if authenticated
  useEffect(() => {
    if (authenticated && step === 'login') {
      setStep('details')
    }
  }, [authenticated, step])

  const handleLogin = async () => {
    setIsLoading(true)
    try {
      login()
      setStep('details')
    } catch (error) {
      console.error('Login failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkillToggle = (skillId: string) => {
    const newSkills = new Set(selectedSkills)
    if (newSkills.has(skillId)) {
      newSkills.delete(skillId)
    } else {
      newSkills.add(skillId)
    }
    setSelectedSkills(newSkills)
  }

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setAvatarUrl(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCreateAgent = async () => {
    if (!agentName || !selectedTemplate || selectedSkills.size === 0) {
      alert('Please fill all required fields')
      return
    }

    setIsLoading(true)
    try {
      // Call agent creation API
      const response = await fetch('/api/v1/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentName,
          template: selectedTemplate,
          skills: Array.from(selectedSkills),
          description,
          avatarUrl,
          userAddress: wallets[0]?.address
        })
      })

      if (!response.ok) throw new Error('Creation failed')

      const agent = await response.json()
      setStep('success')

      // Redirect to agent profile after 2s
      setTimeout(() => router.push(`/agent/${agent.id}`), 2000)
    } catch (error) {
      console.error('Agent creation failed:', error)
      alert('Failed to create agent')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen pb-20 relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f0f1e] via-[#1a1a2e] to-[#16213e]" />
        <div className="absolute top-0 -left-40 w-80 h-80 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
        <div className="absolute top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
      </div>

      <main className="max-w-4xl mx-auto px-6">
        {/* Progress indicator */}
        <div className="pt-12 mb-12">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between text-xs font-bold uppercase tracking-widest"
          >
            {(['login', 'details', 'skills', 'review', 'success'] as const).map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    step === s
                      ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                      : step > s
                        ? 'bg-green-500 text-white'
                        : 'bg-[var(--card-bg)] text-[var(--text-secondary)]'
                  }`}
                >
                  {step > s ? <CheckCircle2 size={16} /> : i + 1}
                </div>
                {i < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition-all ${
                      step > s ? 'bg-green-500' : 'bg-[var(--card-bg)]'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </motion.div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {step === 'login' && !authenticated && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="mb-8"
              >
                <div className="text-6xl mb-4">🤖</div>
                <h1 className="atmosphere-text font-black text-[var(--text-color)]">
                  Create Your <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                    Agent Companion
                  </span>
                </h1>
              </motion.div>

              <p className="text-[var(--text-secondary)] text-xl max-w-xl mx-auto mb-8 font-medium">
                Meet Maiat — where your AI agent isn't just a tool, it's a companion that grows with you
              </p>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLogin}
                disabled={isLoading}
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-12 py-4 rounded-2xl font-bold uppercase tracking-widest text-sm flex items-center gap-3 mx-auto shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Sparkles size={20} />
                )}
                {isLoading ? 'Connecting...' : 'Connect Wallet'}
              </motion.button>

              <p className="text-[var(--text-muted)] text-xs mt-4">
                Email, Google, or Web3 wallet — your choice
              </p>
            </motion.div>
          )}

          {step === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <h2 className="text-3xl font-black text-[var(--text-color)] mb-2">Agent Profile</h2>
              <p className="text-[var(--text-secondary)] mb-8">Give your agent a name and personality</p>

              {/* Avatar upload */}
              <div className="mb-8">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-32 h-32 rounded-2xl bg-[var(--card-bg)] border-2 border-dashed border-[var(--border-color)] flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors group"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <div className="text-center">
                      <Upload size={24} className="mx-auto mb-2 text-[var(--text-secondary)] group-hover:text-blue-400" />
                      <p className="text-xs text-[var(--text-secondary)]">Upload avatar</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>

              {/* Agent name */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-[var(--text-color)] mb-2 uppercase tracking-widest">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g., Trading Wizard, Research Bot"
                  maxLength={50}
                  className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-color)] placeholder-[var(--text-muted)] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
              </div>

              {/* Description */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-[var(--text-color)] mb-2 uppercase tracking-widest">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What should this agent do?"
                  maxLength={200}
                  rows={3}
                  className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-color)] placeholder-[var(--text-muted)] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
              </div>

              {/* Template selection */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-[var(--text-color)] mb-4 uppercase tracking-widest">
                  Agent Template *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {AGENT_TEMPLATES.map((template) => (
                    <motion.button
                      key={template.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedTemplate(template.id)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        selectedTemplate === template.id
                          ? 'border-blue-400 bg-blue-500/10 ring-1 ring-blue-400'
                          : 'border-[var(--border-color)] bg-[var(--card-bg)] hover:border-blue-400/50'
                      }`}
                    >
                      <div className="text-3xl mb-2">{template.icon}</div>
                      <p className="font-bold text-xs text-[var(--text-color)] line-clamp-2">
                        {template.name}
                      </p>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Action button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setStep('skills')}
                disabled={!agentName || !selectedTemplate}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-shadow"
              >
                Next: Pick Skills <ChevronRight size={20} />
              </motion.button>
            </motion.div>
          )}

          {step === 'skills' && (
            <motion.div
              key="skills"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <h2 className="text-3xl font-black text-[var(--text-color)] mb-2">Pick Skills</h2>
              <p className="text-[var(--text-secondary)] mb-8">Equip your agent with abilities. Start free, upgrade anytime.</p>

              {/* Free skills */}
              <div className="mb-12">
                <div className="inline-flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-bold text-[var(--text-color)]">Free Skills</h3>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Always Included</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  {FREE_SKILLS.map((skill) => (
                    <motion.button
                      key={skill.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => handleSkillToggle(skill.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        selectedSkills.has(skill.id)
                          ? 'border-green-400 bg-green-500/10 ring-1 ring-green-400'
                          : 'border-[var(--border-color)] bg-[var(--card-bg)] hover:border-green-400/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-2xl">{skill.icon}</span>
                        {selectedSkills.has(skill.id) && (
                          <CheckCircle2 size={16} className="text-green-400" />
                        )}
                      </div>
                      <p className="font-bold text-sm text-[var(--text-color)]">{skill.name}</p>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Pro skills */}
              <div>
                <div className="inline-flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-bold text-[var(--text-color)]">Pro Skills</h3>
                  <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">Premium</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  {PRO_SKILLS.map((skill) => (
                    <motion.button
                      key={skill.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => handleSkillToggle(skill.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        selectedSkills.has(skill.id)
                          ? 'border-purple-400 bg-purple-500/10 ring-1 ring-purple-400'
                          : 'border-[var(--border-color)] bg-[var(--card-bg)] hover:border-purple-400/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-2xl">{skill.icon}</span>
                        {selectedSkills.has(skill.id) && (
                          <CheckCircle2 size={16} className="text-purple-400" />
                        )}
                      </div>
                      <p className="font-bold text-sm text-[var(--text-color)]">{skill.name}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">{skill.price} SCARAB</p>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setStep('details')}
                  className="flex-1 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-color)] py-4 rounded-xl font-bold uppercase tracking-widest"
                >
                  Back
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('review')}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:shadow-lg transition-shadow"
                >
                  Review <ChevronRight size={20} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <h2 className="text-3xl font-black text-[var(--text-color)] mb-2">Review Your Agent</h2>
              <p className="text-[var(--text-secondary)] mb-8">Everything looks good?</p>

              {/* Summary card */}
              <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-8 mb-8">
                <div className="flex gap-6">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={agentName} className="w-32 h-32 rounded-xl object-cover" />
                  ) : (
                    <div className="w-32 h-32 bg-gradient-to-br from-blue-400 to-purple-400 rounded-xl flex items-center justify-center text-4xl">
                      🤖
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-2xl font-black text-[var(--text-color)] mb-2">{agentName}</h3>
                    <p className="text-[var(--text-secondary)] mb-4">{description}</p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-bold uppercase">
                        {AGENT_TEMPLATES.find((t) => t.id === selectedTemplate)?.name}
                      </span>
                      <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-full font-bold uppercase">
                        {selectedSkills.size} skills
                      </span>
                    </div>
                  </div>
                </div>

                {/* Skills summary */}
                <div className="mt-8 pt-8 border-t border-[var(--border-color)]">
                  <h4 className="font-bold text-[var(--text-color)] mb-4 uppercase tracking-widest text-sm">
                    Equipped Skills
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(selectedSkills).map((skillId) => {
                      const skill = [...FREE_SKILLS, ...PRO_SKILLS].find((s) => s.id === skillId)
                      return (
                        <span
                          key={skillId}
                          className="text-xs bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] px-3 py-1.5 rounded-lg font-bold"
                        >
                          {skill?.icon} {skill?.name}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setStep('skills')}
                  className="flex-1 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-color)] py-4 rounded-xl font-bold uppercase tracking-widest"
                >
                  Back
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreateAgent}
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-lg transition-shadow"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" /> Creating...
                    </>
                  ) : (
                    <>
                      <Zap size={20} /> Create Agent
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="mb-8"
              >
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={40} className="text-green-400" />
                </div>
              </motion.div>

              <h1 className="text-4xl font-black text-[var(--text-color)] mb-4">
                Welcome, <br />
                {agentName}! 🎉
              </h1>

              <p className="text-[var(--text-secondary)] text-xl max-w-xl mx-auto mb-8 font-medium">
                Your agent is now live and ready to work. Redirecting to your agent's profile...
              </p>

              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Loader2 size={32} className="mx-auto text-blue-400" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <style jsx>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>
    </div>
  )
}
