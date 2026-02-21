'use server'

import { prisma } from "@/lib/prisma"
import { analyzeProject, AIAgentAnalysisResult } from "./analyze"
import { searchExternalAPIs } from "@/lib/coingecko"

// Generate a slug from name
function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Generate a unique address from project name (fallback)
function generateProjectAddress(name: string): string {
  const hash = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  const suffix = hash.slice(0, 38).padEnd(38, '0')
  return `0x${suffix}`
}

export interface CreateProjectResult {
  success: boolean
  project?: {
    id: string
    address: string
    name: string
    slug: string
    category: string
    avgRating: number
    description?: string
    image?: string
    website?: string
  }
  analysis?: AIAgentAnalysisResult
  error?: string
  isNew: boolean
}

/**
 * Search for project, auto-create from CoinGecko/DeFiLlama if not exists
 */
export async function findOrCreateProject(query: string): Promise<CreateProjectResult> {
  const searchTerm = query.toLowerCase().trim()
  
  try {
    // 1. Check if project already exists
    const existingProject = await prisma.project.findFirst({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { slug: { equals: searchTerm } },
          { address: { contains: searchTerm, mode: 'insensitive' } },
        ]
      }
    })
    
    if (existingProject) {
      return {
        success: true,
        project: {
          id: existingProject.id,
          address: existingProject.address,
          name: existingProject.name,
          slug: existingProject.slug,
          category: existingProject.category,
          avgRating: existingProject.avgRating,
          description: existingProject.description || undefined,
          image: existingProject.image || undefined,
          website: existingProject.website || undefined,
        },
        isNew: false,
      }
    }
    
    // 2. Search CoinGecko + DeFiLlama
    console.log(`[Maiat] "${query}" not in DB, searching CoinGecko/DeFiLlama...`)
    const externalData = await searchExternalAPIs(query)
    
    if (externalData) {
      console.log(`[Maiat] Found on ${externalData.source}: ${externalData.name}`)
      
      const slug = generateSlug(externalData.name)
      const address = externalData.address || generateProjectAddress(externalData.name)
      
      // Check slug uniqueness
      const existingSlug = await prisma.project.findUnique({ where: { slug } })
      const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug
      
      // Check address uniqueness
      const existingAddr = await prisma.project.findUnique({ where: { address } })
      const finalAddress = existingAddr ? `${address.slice(0, 38)}01` : address
      
      const newProject = await prisma.project.create({
        data: {
          address: finalAddress,
          name: externalData.name,
          slug: finalSlug,
          description: externalData.description || `${externalData.name}${externalData.symbol ? ` ($${externalData.symbol})` : ''} — discovered via ${externalData.source === 'coingecko' ? 'CoinGecko' : 'DeFiLlama'}`,
          image: externalData.image || null,
          website: externalData.website || null,
          category: externalData.category,
          avgRating: 0,
          reviewCount: 0,
          status: 'approved',
        }
      })
      
      console.log(`[Maiat] Auto-created: ${newProject.name} (${newProject.slug}) [${externalData.source}]`)
      
      return {
        success: true,
        project: {
          id: newProject.id,
          address: newProject.address,
          name: newProject.name,
          slug: newProject.slug,
          category: newProject.category,
          avgRating: 0,
          description: newProject.description || undefined,
          image: newProject.image || undefined,
          website: newProject.website || undefined,
        },
        isNew: true,
      }
    }
    
    // 3. Fallback: Gemini analysis for unknown projects
    console.log(`[Maiat] Not found on external APIs, trying Gemini analysis...`)
    const analysis = await analyzeProject(query)
    
    const slug = generateSlug(analysis.name || query)
    const address = generateProjectAddress(analysis.name || query)
    
    const existingSlug = await prisma.project.findUnique({ where: { slug } })
    const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug
    const existingAddr = await prisma.project.findUnique({ where: { address } })
    const finalAddress = existingAddr ? `${address.slice(0, 38)}02` : address
    
    const category = analysis.type === 'DeFi' ? 'm/defi' : 'm/ai-agents'
    
    const newProject = await prisma.project.create({
      data: {
        address: finalAddress,
        name: analysis.name || query,
        slug: finalSlug,
        description: analysis.summary,
        website: analysis.website,
        category,
        avgRating: 0,
        reviewCount: 0,
        status: 'approved',
      }
    })
    
    return {
      success: true,
      project: {
        id: newProject.id,
        address: newProject.address,
        name: newProject.name,
        slug: newProject.slug,
        category: newProject.category,
        avgRating: 0,
        description: newProject.description || undefined,
        website: newProject.website || undefined,
      },
      analysis,
      isNew: true,
    }
    
  } catch (error) {
    console.error('[Maiat] findOrCreateProject error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      isNew: false,
    }
  }
}
