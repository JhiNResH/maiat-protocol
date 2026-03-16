import { Maiat } from "@jhinresh/maiat-sdk";
// Simple in-memory cache: address → { result, expiresAt }
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let sdkInstance = null;
function getSDK(apiKey) {
    if (!sdkInstance) {
        sdkInstance = new Maiat({
            apiKey,
            framework: 'viem-guard',
            clientId: 'viem-guard-standard'
        });
    }
    return sdkInstance;
}
export async function checkTrust(address, apiKey) {
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address))
        return null;
    const lowerAddr = address.toLowerCase();
    // Cache hit
    const cached = cache.get(lowerAddr);
    if (cached && Date.now() < cached.expiresAt) {
        return { ...cached.result, source: 'cache' };
    }
    try {
        const sdk = getSDK(apiKey);
        const res = await sdk.agentTrust(lowerAddr);
        let result = {
            address: lowerAddr,
            score: res.trustScore,
            riskLevel: res.verdict === 'proceed' ? 'Low' : (res.verdict === 'caution' ? 'Medium' : 'High'),
            verdict: res.verdict === 'avoid' ? 'block' : 'allow',
            source: 'api',
        };
        // If the agent lookup returned no meaningful data, try tokenCheck as fallback
        if (res.dataSource === 'unknown' || res.trustScore === 0) {
            try {
                const tokenRes = await sdk.tokenCheck(lowerAddr);
                if (tokenRes.trustScore > 0) {
                    result = {
                        address: lowerAddr,
                        score: tokenRes.trustScore,
                        riskLevel: tokenRes.verdict === 'proceed' ? 'Low' : (tokenRes.verdict === 'caution' ? 'Medium' : 'High'),
                        verdict: tokenRes.verdict === 'avoid' ? 'block' : 'allow',
                        source: 'token-check',
                    };
                }
            }
            catch {
                // tokenCheck failed — keep the original agent result
            }
        }
        cache.set(lowerAddr, { result, expiresAt: Date.now() + CACHE_TTL_MS });
        return result;
    }
    catch {
        // Timeout or network error → fail-open
        return null;
    }
}
export async function checkTokenTrust(address, apiKey) {
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address))
        return null;
    const lowerAddr = address.toLowerCase();
    const cached = cache.get(`token:${lowerAddr}`);
    if (cached && Date.now() < cached.expiresAt) {
        return { ...cached.result, source: 'cache' };
    }
    try {
        const sdk = getSDK(apiKey);
        const [tokenRes, forensicsRes] = await Promise.all([
            sdk.tokenCheck(lowerAddr),
            sdk.forensics(lowerAddr).catch(() => null),
        ]);
        // Merge: use the worse verdict if forensics also returns data
        let verdict = tokenRes.verdict;
        if (forensicsRes && forensicsRes.verdict === 'avoid') {
            verdict = 'avoid';
        }
        else if (forensicsRes && forensicsRes.verdict === 'caution' && verdict === 'proceed') {
            verdict = 'caution';
        }
        const result = {
            address: lowerAddr,
            score: tokenRes.trustScore,
            riskLevel: verdict === 'proceed' ? 'Low' : (verdict === 'caution' ? 'Medium' : 'High'),
            verdict: verdict === 'avoid' ? 'block' : 'allow',
            source: 'token-forensics',
        };
        cache.set(`token:${lowerAddr}`, { result, expiresAt: Date.now() + CACHE_TTL_MS });
        return result;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=trust-check.js.map