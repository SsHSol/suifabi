/**
 * Sui 新币监控
 * 通过 rpc-mainnet.suiscan.xyz 查询最新代币
 */
import { spawnSync } from 'child_process';

const RPC = 'https://rpc-mainnet.suiscan.xyz';
const PROXY = 'http://127.0.0.1:7897';
const INTERVAL = 45000; // 45秒

function rpc(method, params = []) {
  const payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const buf = spawnSync('curl', [
    '-sk', '--proxy', PROXY, '-m', '10',
    '-X', 'POST', RPC,
    '-H', 'Content-Type: application/json',
    '-d', payload
  ], { encoding: 'utf-8', timeout: 15000 });
  try { return JSON.parse(buf.stdout).result || null; }
  catch { return null; }
}

let lastSeq = 0;

async function checkNewTokens() {
  try {
    const seq = rpc('sui_getLatestCheckpointSequenceNumber');
    if (!seq) { console.log(`✗ ${new Date().toLocaleTimeString()} - RPC 无响应`); return; }

    const currentSeq = Number(seq);
    if (lastSeq === 0) {
      lastSeq = currentSeq;
      console.log(`✓ 启动完成，当前检查点 #${currentSeq}`);
      return;
    }

    // 只检查最新一个检查点
    if (currentSeq <= lastSeq) return;
    lastSeq = currentSeq;

    const cp = rpc('sui_getCheckpoint', [String(currentSeq)]);
    if (!cp?.transactions?.length) return;

    for (const txDigest of cp.transactions) {
      const tx = rpc('sui_getTransactionBlock', [txDigest, {
        showObjectChanges: true,
        showInput: true,
        showEffects: true
      }]);

      const changes = tx?.objectChanges || [];
      for (const c of changes) {
        if (c.type === 'created' && c.objectType?.includes('CoinMetadata')) {
          const name = (c.objectType.match(/::(\w+)::/) || [])[1] || '?';
          const pkgId = (c.objectType.match(/^(0x[a-f0-9]+)/) || [])[1] || '';
          console.log(`\n🪙 新代币: ${name}`);
          console.log(`   Package: ${pkgId}`);
          console.log(`   检查点: #${currentSeq}`);
          console.log(`   查看: https://suivision.xyz/package/${pkgId}`);
        }
      }
    }
    console.log(`✓ ${new Date().toLocaleTimeString()} - 检查点 #${currentSeq} (${cp.transactions.length} 笔交易)`);
  } catch (e) {
    console.error(`✗ ${e.message?.substring(0, 80)}`);
  }
}

console.log('🔍 Sui 新币监控');
console.log(`   间隔: ${INTERVAL/1000}s | RPC: rpc-mainnet.suiscan.xyz\n`);

await checkNewTokens();
setInterval(checkNewTokens, INTERVAL);
