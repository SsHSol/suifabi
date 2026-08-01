/**
 * Sui 新币监控
 * 监控主网新发布的代币包
 * 每 30 秒扫描一次最新交易
 */
const { SuiClient, getFullnodeUrl } = require("@mysten/sui.js/client");
const fs = require("fs");
const path = require("path");

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
const DATA_FILE = path.join(__dirname, "monitored_tokens.json");

// 已监控列表
let monitored = new Set();
if (fs.existsSync(DATA_FILE)) {
  try {
    const old = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    old.packages?.forEach(p => monitored.add(p.id));
  } catch (_) {}
}

async function checkNewTokens() {
  try {
    // 获取最新检查点
    const checkpoint = await client.getLatestCheckpointSequenceNumber();
    const seq = Number(checkpoint);

    // 检查最近 3 个检查点
    for (let i = Math.max(0, seq - 3); i <= seq; i++) {
      const cp = await client.getCheckpoint({ id: String(i) });
      if (!cp.transactions) continue;

      for (const txDigest of cp.transactions) {
        try {
          const tx = await client.getTransactionBlock({
            digest: txDigest,
            options: { showInput: true, showEffects: true, showEvents: true }
          });

          // 只关注成功的发布交易
          if (tx.effects?.status?.status !== "success") continue;

          // 检查是否有新包发布
          const created = tx.effects.created || [];
          const packages = created.filter(c => c.specifier === "package" || c.owner?.Immutable);

          for (const obj of created) {
            // 通过 ObjectType 判断是否是 CoinMetadata（说明这是新代币）
            if (obj.objectType?.includes("coin::CoinMetadata")) {
              const pkgMatch = obj.objectType.match(/^0x[a-f0-9]+::([^:]+)::/);
              const name = pkgMatch?.[1] || "unknown";

              if (!monitored.has(obj.objectId)) {
                monitored.add(obj.objectId);
                console.log(`\n🪙 新代币: ${obj.objectId}`);
                console.log(`   Package: ${obj.objectId.substring(0, 20)}...`);
                console.log(`   类型: ${obj.objectType?.substring(0, 80)}...`);
                console.log(`   时间: ${new Date().toLocaleString()}`);
              }
            }
          }
        } catch (_) { /* 跳过解析失败的交易 */ }
      }
    }

    // 保存
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      packages: Array.from(monitored).map(id => ({ id, seenAt: new Date().toISOString() })),
      lastCheck: new Date().toISOString()
    }, null, 2));
  } catch (e) {
    console.error("❌", e.message?.substring(0, 100));
  }
}

console.log("🔍 Sui 新币监控启动...");
console.log(`   已监控 ${monitored.size} 个包`);

// 每 30 秒检查一次
checkNewTokens();
setInterval(checkNewTokens, 30000);
