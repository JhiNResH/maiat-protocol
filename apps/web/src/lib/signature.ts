/**
 * Wallet signature verification using viem
 * Prevents address spoofing attacks
 */

import { verifyMessage, type Hex } from 'viem'

/**
 * Verify that a signature was created by the claimed address
 * @param message - The message that was signed
 * @param signature - The signature hex string
 * @param address - The claimed signer address
 * @returns true if signature is valid, false otherwise
 */
export async function verifyWalletSignature(
  message: string,
  signature: Hex,
  address: Hex
): Promise<boolean> {
  try {
    const isValid = await verifyMessage({
      address,
      message,
      signature,
    })
    return isValid
  } catch (error) {
    console.error('Signature verification failed:', error)
    return false
  }
}

/**
 * Timestamp must be within ±5 minutes of current time to prevent replay attacks
 */
export function isTimestampValid(timestamp: number): boolean {
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000
  return Math.abs(now - timestamp) < fiveMinutes
}
