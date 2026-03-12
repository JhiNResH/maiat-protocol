
import { NextRequest } from 'next/server';
import { GET as agentTrustGET } from '../src/app/api/v1/agent/[address]/route';
import { GET as agentProfileGET } from '../src/app/api/v1/agent/[address]/profile/route';
import { GET as tokenCheckGET } from '../src/app/api/v1/token/[address]/route';
import { GET as tokenForensicsGET } from '../src/app/api/v1/token/[address]/forensics/route';

async function testApi(name: string, handler: any, address: string) {
  console.log(`\n=== Testing ${name} for ${address} ===`);
  const req = new NextRequest(`http://localhost/api/v1/${name}/${address}`);
  const params = Promise.resolve({ address });
  
  try {
    const response = await handler(req, { params });
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(JSON.stringify(data, null, 2).substring(0, 500) + (JSON.stringify(data).length > 500 ? '...' : ''));
  } catch (err: any) {
    console.error(`Error testing ${name}:`, err.message);
  }
}

async function main() {
  const agentAddr = '0x5eF6Fe50413e5eaCA3a75EEC2Cd98A238c64bAF3';
  const tokenAddr = '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b'; // VIRTUAL

  await testApi('agent_trust', agentTrustGET, agentAddr);
  await testApi('agent_profile', agentProfileGET, agentAddr);
  await testApi('token_check', tokenCheckGET, tokenAddr);
  await testApi('token_forensics', tokenForensicsGET, tokenAddr);
}

main().catch(console.error);
