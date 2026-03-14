/**
 * Passport Auto-Create Middleware
 *
 * Any API call with X-Maiat-Client header → upsert Passport + ENS subdomain.
 * Non-blocking: passport creation happens in background, doesn't slow API response.
 *
 * Usage in API routes:
 *   import { autoCreatePassport } from "@/lib/passport-middleware";
 *   // At start of handler:
 *   autoCreatePassport(req);
 */

import { prisma } from "@/lib/prisma";
import {
  generateEnsName,
  setSubdomain,
  isNameAvailable,
  buildPassportTextRecords,
} from "@/lib/namestone";

// In-flight dedup: don't create multiple passports for same clientId simultaneously
const inflight = new Set<string>();

/**
 * Auto-create or update a passport from an API request.
 * Call this at the start of any API handler — it runs in background.
 */
export function autoCreatePassport(req: Request): void {
  const clientId = req.headers.get("x-maiat-client");
  if (!clientId) return;

  // Dedup
  if (inflight.has(clientId)) return;
  inflight.add(clientId);

  // Fire and forget
  upsertPassport(clientId).finally(() => {
    inflight.delete(clientId);
  });
}

async function upsertPassport(clientId: string): Promise<void> {
  try {
    // Check if passport exists
    const existing = await prisma.passport.findUnique({
      where: { clientId },
    });

    if (existing) {
      // Update activity
      await prisma.passport.update({
        where: { id: existing.id },
        data: {
          totalQueries: { increment: 1 },
          lastActiveAt: new Date(),
        },
      });
      return;
    }

    // Create new passport
    const ensName = generateEnsName(undefined, undefined);
    let finalEnsName = ensName;

    const available = await isNameAvailable(finalEnsName);
    if (!available) {
      finalEnsName = `agent-${Date.now().toString(36)}`;
    }

    const passport = await prisma.passport.create({
      data: {
        clientId,
        ensName: finalEnsName,
        type: "agent",
        status: "active",
        scarabBalance: 10,
        totalQueries: 1,
      },
    });

    // Create ENS subdomain (best effort)
    const textRecords = buildPassportTextRecords(passport);
    await setSubdomain({
      name: finalEnsName,
      address: "0x0000000000000000000000000000000000000000",
      textRecords,
    }).catch((err) => {
      console.error(`[passport-middleware] ENS failed for ${clientId}:`, err);
    });

    console.log(`[passport-middleware] Created passport ${finalEnsName}.maiat.eth for ${clientId}`);
  } catch (err: any) {
    // Don't crash the API — just log
    if (err?.code === "P2002") {
      // Unique constraint violation — race condition, passport already created
      return;
    }
    console.error(`[passport-middleware] Error for ${clientId}:`, err?.message);
  }
}
