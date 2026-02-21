'use server'

import { GoogleGenerativeAI } from "@google/generative-ai"
import { prisma } from "@/lib/prisma"

// Initialize Google GenAI with the API Key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export interface AIAgentAnalysisResult {
  name: string
  type: 'AI Agent' | 'DeFi' | 'Other'
  chain: string[]
  score: number
  status: 'VERIFIED' | 'UNSTABLE' | 'RISKY'
  summary: string
  image?: string
  website?: string
  twitter?: string
  github?: string
  tokenSymbol?: string
  launchDate?: string
  features: string[]
  warnings: string[]
  recentNews?: { title: string; date?: string }[]
  _cached?: boolean
  _cacheAge?: number
}

/**
 * Analyze AI Agent or DeFi project using Gemini
 */
export async function analyzeProject(query: string): Promise<AIAgentAnalysisResult> {
  console.log(`[Maiat] Analyzing project: "${query}"`)
  
  try {
    const isUrl = /^https?:\/\//i.test(query.trim())
    
    const prompt = isUrl
      ? `Analyze this AI Agent or DeFi project from the URL: "${query}"\n\nExtract the project name and research comprehensive data about it.`
      : `Search for comprehensive information about the AI Agent or DeFi project: "${query}"`

    console.log('[Maiat] Starting analysis for:', query)
    console.log('[Maiat] API Key exists:', !!process.env.GOOGLE_GENERATIVE_AI_API_KEY)

    // Use Gemini 2.0 Flash
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      tools: [{ googleSearch: {} } as any] 
    })

    // Add timeout protection (30 seconds)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Analysis timeout (30s)')), 30000)
    })

    const result = await Promise.race([
      model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: `You are Maiat, an AI analyzing Web3 AI Agents and DeFi projects.

TASK: Research AI agents and DeFi protocols from multiple sources (official website, Twitter, GitHub, news articles).

CRITICAL RULES:
1. NO HALLUCINATIONS: Only report data you actually find.
2. VERIFY THE PROJECT: Check official sources.
3. Focus on AI Agent capabilities OR DeFi protocol features.
4. Look for red flags: security issues, team problems.
5. RESPONSE LANGUAGE: All text fields MUST be in English.

RETURN JSON FORMAT ONLY:
{
  "name": "Project Name",
  "type": "AI Agent|DeFi|Other",
  "chain": ["BNB Chain", "Ethereum"],
  "score": 0.0-5.0,
  "status": "VERIFIED|UNSTABLE|RISKY",
  "summary": "2-3 sentence summary of the project.",
  "website": "https://example.com",
  "twitter": "@projecthandle",
  "github": "https://github.com/org/repo",
  "tokenSymbol": "TOKEN",
  "launchDate": "2023-01",
  "features": ["Feature 1", "Feature 2"],
  "warnings": ["Warning 1"],
  "recentNews": [
    {"title": "Recent news", "date": "2024-01"}
  ]
}

SCORING GUIDE:
- 4.0-5.0 (VERIFIED): Well-established, audited, active development
- 2.5-3.9 (UNSTABLE): Some concerns, limited info
- 0-2.4 (RISKY): Red flags found, unverified`
      }),
      timeoutPromise
    ])

    console.log('Maiat Raw Response:', result.response.text())

    const text = result.response.text() || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON found in response:', text)
      throw new Error('No JSON found')
    }

    const data = JSON.parse(jsonMatch[0])
    
    const score = data.score || 0
    const status = data.status || (score >= 4.0 ? 'VERIFIED' : score < 2.5 ? 'RISKY' : 'UNSTABLE')

    const analysisResult: AIAgentAnalysisResult = {
      name: data.name || query,
      type: data.type || 'Other',
      chain: data.chain || [],
      score,
      status: status,
      summary: data.summary || 'Unable to complete analysis',
      website: data.website,
      twitter: data.twitter,
      github: data.github,
      tokenSymbol: data.tokenSymbol,
      launchDate: data.launchDate,
      features: data.features || [],
      warnings: data.warnings || [],
      recentNews: data.recentNews || [],
    }
    
    return analysisResult
  } catch (error) {
    console.error('[Maiat] Analysis Failed:', error)
    
    let errorMsg = 'Analysis service unavailable'
    let errorDetails = ['Analysis service temporarily unavailable']
    
    if (error instanceof Error) {
      console.error('[Maiat] Error details:', error.message)
      
      if (error.message.includes('timeout')) {
        errorMsg = 'Analysis timeout'
        errorDetails = ['Request exceeded 30 seconds']
      } else if (error.message.includes('API key')) {
        errorMsg = 'API configuration error'
        errorDetails = ['Check GOOGLE_GENERATIVE_AI_API_KEY']
      }
    }
    
    return {
      name: query,
      type: 'Other',
      chain: [],
      score: 0,
      status: 'UNSTABLE',
      summary: errorMsg,
      features: [],
      warnings: errorDetails,
    } as AIAgentAnalysisResult
  }
}
