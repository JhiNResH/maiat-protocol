/**
 * NameStone ENS Subdomain Management
 *
 * Creates/manages offchain ENS subdomains under maiat.eth
 * via NameStone CCIP-Read resolver (same as Uniswap uni.eth)
 *
 * Zero gas, instant resolution, any ENS-compatible app can resolve.
 */

const NAMESTONE_API = "https://namestone.com/api/public_v1";
const DOMAIN = "maiat.eth";

function getApiKey(): string {
  const key = process.env.NAMESTONE_API_KEY;
  if (!key) throw new Error("NAMESTONE_API_KEY not configured");
  return key;
}

/** Sanitize and validate an ENS subdomain name */
export function sanitizeEnsName(input: string): string | null {
  // Lowercase, remove .maiat.eth suffix if present
  let name = input.toLowerCase().replace(/\.maiat\.eth$/, "").trim();

  // Only allow a-z, 0-9, hyphen
  name = name.replace(/[^a-z0-9-]/g, "");

  // Remove leading/trailing hyphens
  name = name.replace(/^-+|-+$/g, "");

  // Min 3 chars
  if (name.length < 3) return null;

  // Max 32 chars
  if (name.length > 32) name = name.slice(0, 32);

  return name;
}

/** Generate ENS name from agent name or wallet */
export function generateEnsName(
  name?: string,
  walletAddress?: string
): string {
  if (name) {
    const sanitized = sanitizeEnsName(name);
    if (sanitized) return sanitized;
  }

  if (walletAddress) {
    // Use first 8 chars of address (after 0x)
    return `0x${walletAddress.slice(2, 10).toLowerCase()}`;
  }

  // Fallback: random
  return `agent-${Date.now().toString(36)}`;
}

export interface SetNameParams {
  name: string; // subdomain (without .maiat.eth)
  address: string; // ETH address to resolve to
  textRecords?: Record<string, string>;
}

/** Create or update an ENS subdomain under maiat.eth */
export async function setSubdomain(params: SetNameParams): Promise<boolean> {
  const { name, address, textRecords } = params;

  const body: Record<string, unknown> = {
    domain: DOMAIN,
    name,
    address,
  };

  if (textRecords && Object.keys(textRecords).length > 0) {
    body.text_records = textRecords;
  }

  const res = await fetch(`${NAMESTONE_API}/set-name`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getApiKey(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[namestone] set-name failed: ${res.status} ${text}`);
    return false;
  }

  const data = await res.json();
  return data.success === true;
}

/** Delete an ENS subdomain */
export async function deleteSubdomain(name: string): Promise<boolean> {
  const res = await fetch(`${NAMESTONE_API}/delete-name`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getApiKey(),
    },
    body: JSON.stringify({ domain: DOMAIN, name }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[namestone] delete-name failed: ${res.status} ${text}`);
    return false;
  }

  return true;
}

/** Check if a subdomain name is available */
export async function isNameAvailable(name: string): Promise<boolean> {
  const res = await fetch(
    `${NAMESTONE_API}/get-names?domain=${DOMAIN}&name=${name}`,
    {
      headers: { Authorization: getApiKey() },
    }
  );

  if (!res.ok) return true; // assume available on error

  const data = await res.json();
  return !Array.isArray(data) || data.length === 0;
}

/** Rename: delete old, set new */
export async function renameSubdomain(
  oldName: string,
  newName: string,
  address: string,
  textRecords?: Record<string, string>
): Promise<boolean> {
  await deleteSubdomain(oldName);
  return setSubdomain({ name: newName, address, textRecords });
}

/** Build ENS text records for a passport */
export function buildPassportTextRecords(passport: {
  type: string;
  ownerAddress?: string | null;
  erc8004Id?: string | null;
  acpAgentId?: string | null;
  ensName?: string | null;
}): Record<string, string> {
  const records: Record<string, string> = {
    url: `https://app.maiat.io/passport/${passport.ensName || ""}`,
    description: "Maiat Agent Passport — Trust Layer for Agentic Commerce",
    "com.maiat.type": passport.type,
  };

  if (passport.ownerAddress) {
    records["com.maiat.owner"] = passport.ownerAddress;
  }
  if (passport.erc8004Id) {
    records["com.maiat.8004.id"] = passport.erc8004Id;
  }
  if (passport.acpAgentId) {
    records["com.maiat.acp.id"] = passport.acpAgentId;
  }

  return records;
}
