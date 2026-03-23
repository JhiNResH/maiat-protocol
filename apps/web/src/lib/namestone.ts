/**
 * NameStone API — Offchain ENS subname management
 * Sets gasless subnames under maiat.eth via NameStone's resolver
 */

const NAMESTONE_API = 'https://namestone.com/api/public_v1';
const DOMAIN = 'maiat.eth';

function getApiKey(): string {
  const key = process.env.NAMESTONE_API_KEY;
  if (!key) throw new Error('NAMESTONE_API_KEY not set');
  return key;
}

/**
 * Set (or overwrite) an offchain ENS subname: name.maiat.eth → address
 */
export async function setEnsSubname(
  name: string,
  address: string,
  textRecords?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      domain: DOMAIN,
      name,
      address,
    };

    if (textRecords && Object.keys(textRecords).length > 0) {
      body.text_records = textRecords;
    }

    const res = await fetch(`${NAMESTONE_API}/set-name`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getApiKey(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      console.error(`[namestone] set-name failed (${res.status}):`, errText);
      return { success: false, error: `NameStone API error: ${res.status}` };
    }

    console.log(`[namestone] ✅ ${name}.${DOMAIN} → ${address}`);
    return { success: true };
  } catch (err: any) {
    console.error('[namestone] set-name exception:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Delete an offchain ENS subname
 */
export async function deleteEnsSubname(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${NAMESTONE_API}/delete-name`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getApiKey(),
      },
      body: JSON.stringify({ domain: DOMAIN, name }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      return { success: false, error: `NameStone API error: ${res.status} - ${errText}` };
    }

    console.log(`[namestone] 🗑️ deleted ${name}.${DOMAIN}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Look up an ENS subname
 */
export async function getEnsSubname(name: string): Promise<{ address?: string; textRecords?: Record<string, string> } | null> {
  try {
    const res = await fetch(`${NAMESTONE_API}/get-names?domain=${DOMAIN}&name=${name}`, {
      headers: { 'Authorization': getApiKey() },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    return {
      address: data[0].address,
      textRecords: data[0].text_records,
    };
  } catch {
    return null;
  }
}
