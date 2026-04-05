import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/skills/[id]/purchase
 *
 * Phase 1: Stripe stub — creates a SkillPurchase record in "pending" state.
 * Real Stripe webhook will flip status to "completed" when payment confirms.
 *
 * Phase 2: x402 atomic payment — buyerAddress signs a payment intent,
 * on-chain settlement triggers ERC-1155 mint + auto-equip to TBA.
 *
 * Body:
 *   buyerAddress: string  — wallet or Privy DID
 *   agentId?: string      — if provided, auto-equip to this agent after purchase
 *   paymentMethod?: "stripe" | "usdc"  — default "stripe" (Phase 1)
 *   stripePaymentIntentId?: string     — from Stripe frontend flow
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: skillId } = params
    const body = await request.json()
    const { buyerAddress, agentId, paymentMethod = 'stripe', stripePaymentIntentId } = body

    if (!buyerAddress || typeof buyerAddress !== 'string') {
      return NextResponse.json({ error: 'buyerAddress is required' }, { status: 400 })
    }

    // --- Fetch skill ---
    const skill = await prisma.skill.findUnique({
      where: { id: skillId },
      select: {
        id: true,
        name: true,
        priceUsdc: true,
        isPro: true,
        isPublished: true,
        creatorAddress: true,
        royaltyPercent: true,
      },
    })

    if (!skill || !skill.isPublished) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }

    const normalizedBuyer = buyerAddress.toLowerCase()

    // --- Check for existing completed purchase (idempotent) ---
    const existingPurchase = await prisma.skillPurchase.findFirst({
      where: {
        skillId,
        buyerAddress: normalizedBuyer,
        status: 'completed',
      },
    })
    if (existingPurchase) {
      return NextResponse.json({
        success: true,
        alreadyOwned: true,
        purchase: {
          id: existingPurchase.id,
          status: existingPurchase.status,
          amountUsdc: existingPurchase.amountUsdc,
        },
      })
    }

    // --- Free skill: auto-complete ---
    if (skill.priceUsdc === 0) {
      const purchase = await prisma.$transaction(async (tx) => {
        const p = await tx.skillPurchase.create({
          data: {
            buyerAddress: normalizedBuyer,
            skillId,
            amountUsdc: 0,
            status: 'completed',
            autoEquipped: !!agentId,
          },
        })

        await tx.skill.update({
          where: { id: skillId },
          data: { totalPurchases: { increment: 1 } },
        })

        // Auto-equip if agentId provided and buyer owns the agent
        if (agentId) {
          const agent = await tx.agent.findFirst({
            where: { id: agentId, ownerAddress: normalizedBuyer },
          })
          if (agent) {
            await tx.skillEquipment.upsert({
              where: { agentId_skillId: { agentId, skillId } },
              update: { isActive: true },
              create: { agentId, skillId },
            })
            await tx.skill.update({
              where: { id: skillId },
              data: { totalInstalls: { increment: 1 } },
            })
          }
        }

        return p
      })

      return NextResponse.json({
        success: true,
        purchase: {
          id: purchase.id,
          status: purchase.status,
          amountUsdc: 0,
          skillId,
          message: 'Free skill acquired',
        },
      }, { status: 201 })
    }

    // --- Paid skill: create pending purchase ---
    // Phase 1: Stripe intent received from frontend Stripe Elements
    // Phase 2: replace with x402 payment channel
    const purchase = await prisma.skillPurchase.create({
      data: {
        buyerAddress: normalizedBuyer,
        skillId,
        amountUsdc: skill.priceUsdc,
        status: 'pending',
        // txHash will be set by Stripe webhook on confirmation
      },
    })

    // --- Revenue split calculation (for reference / future Stripe metadata) ---
    const creatorCut = skill.priceUsdc * (skill.royaltyPercent / 100)
    const platformCut = skill.priceUsdc * 0.10
    const evaluatorCut = skill.priceUsdc * 0.05

    return NextResponse.json({
      success: true,
      purchase: {
        id: purchase.id,
        status: 'pending',
        amountUsdc: skill.priceUsdc,
        skillId,
        skillName: skill.name,
        paymentMethod,
        // Stripe: frontend should now confirm the payment intent
        // The webhook at /api/webhooks/stripe will flip status to "completed"
        stripePaymentIntentId: stripePaymentIntentId || null,
        revenueSplit: {
          creator: creatorCut,
          platform: platformCut,
          evaluators: evaluatorCut,
        },
        message: 'Purchase pending — awaiting payment confirmation',
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/skills/[id]/purchase]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
