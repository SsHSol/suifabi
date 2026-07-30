/**
 * Sui 一键发币 - 本地脚本
 * 用法: node deploy.js <名称> <符号> [精度] [供应量] [图片路径]
 * 示例: node deploy.js MyToken MTK 9 1000000000 C:/logo.png
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
const FormData = require("form-data");

const SUI = "C:\\Users\\z\\sui\\bin\\sui.exe";
const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJiMmE3YzZhNi0zNDRkLTRjZjYtYTE3NC0yMjRiY2RlYmZhNmYiLCJlbWFpbCI6InNzaHp1aUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiOTdlMWFlYjIzZWU1MDA2NDY5MmUiLCJzY29wZWRLZXlTZWNyZXQiOiI3YWUxZWNhZTc2OTJiZjE3NTg0NGFmNDUzMWViZmZhYzRhNDI3YTFjN2MwNDhkMzc2OTc0NzBmMWU3MzU2ZjcwIiwiZXhwIjoxODE2OTU5MzYwfQ.UGLnVpJxDyAuAvLKu0jYOUJb7w1KPF_gzmUjf6stFwA";

function run(cmd) { return execSync(cmd, { encoding: "utf-8", stdio: "pipe" }).trim(); }
function runAndLog(cmd, label) { console.log(`\n${label}...`); const r = execSync(cmd, { encoding: "utf-8", stdio: "pipe" }).trim(); return r; }

async function uploadImage(filePath) {
  console.log("\n📤 上传头像...");
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));
  const res = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${PINATA_JWT}` },
    maxContentLength: Infinity, maxBodyLength: Infinity,
  });
  console.log(`  ✅ ${res.data.IpfsHash}`);
  return `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;
}

async function main() {
  const args = process.argv.slice(2);
  const name = args[0] || "MyToken";
  const symbol = args[1] || "MTK";
  const decimals = args[2] || "9";
  const supply = args[3] || "1000000000";
  const imagePath = args[4] || "";
  const desc = name;

  // 上传图片
  let iconUrl = "";
  if (imagePath && fs.existsSync(imagePath)) iconUrl = await uploadImage(imagePath);
  else console.log("⏭️ 无头像");

  // 生成模块名
  const mod = "t" + crypto.randomBytes(4).toString("hex");
  const dir = path.join(__dirname, `sui_${mod}`);
  const iconLine = iconUrl ? `option::some(url::new_unsafe_from_bytes(b"${iconUrl}"))` : "option::none()";

  // 创建项目
  console.log("\n📁 创建项目...");
  fs.mkdirSync(path.join(dir, "sources"), { recursive: true });

  fs.writeFileSync(path.join(dir, "Move.toml"),
    `[package]\nname = "${mod}"\nversion = "1.0.0"\n[addresses]\n${mod} = "0x0"\n`);

  fs.writeFileSync(path.join(dir, "sources", `${mod}.move`),
    `#[allow(deprecated_usage)]\nmodule ${mod}::${mod} {\n` +
    `    use std::option;\n    use sui::coin::{Self, Coin, TreasuryCap};\n` +
    `    use sui::transfer;\n    use sui::tx_context::{Self, TxContext};\n` +
    `    use sui::url;\n\n    struct ${symbol} has drop {}\n\n` +
    `    fun init(witness: ${symbol}, ctx: &mut TxContext) {\n` +
    `        let (treasury_cap, metadata) = coin::create_currency<${symbol}>(\n` +
    `            witness, ${decimals}, b"${symbol}", b"${name}", b"${desc}", ${iconLine}, ctx,\n` +
    `        );\n        transfer::public_freeze_object(metadata);\n` +
    `        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));\n    }\n` +
    `    public fun mint(cap: &mut TreasuryCap<${symbol}>, amount: u64, recipient: address, ctx: &mut TxContext) {\n` +
    `        let coin = coin::mint(cap, amount, ctx);\n        transfer::public_transfer(coin, recipient);\n    }\n}\n`);

  console.log(`  ✅ 项目: ${dir}`);

  // 切主网
  run(`${SUI} client switch --env mainnet`);
  console.log("🌐 主网");

  // 编译
  console.log("\n🔨 编译...");
  try { run(`${SUI} move build --path "${dir}"`); }
  catch (e) { console.error("❌ 编译失败:", e.stderr?.slice(0, 500) || e.message); process.exit(1); }
  console.log("  ✅ 编译成功");

  // 发布
  console.log("\n🚀 发布到主网...");
  let output;
  try { output = run(`${SUI} client publish --path "${dir}" --gas-budget 50000000`); }
  catch (e) { output = e.stdout || e.message; }
  console.log(output);

  // 解析
  const pkgId = (output.match(/PackageID:\s*(0x[a-f0-9]+)/) || [])[1];
  const tcMatch = output.match(/TreasuryCap[^}]*}\s*(0x[a-f0-9]+)/);
  const tcId = tcMatch ? tcMatch[1] : (output.match(/TreasuryCap[^}]*}\s*\n\s*(\S+)/) || [])[1];
  const addr = run(`${SUI} client active-address`).split("\n").pop().trim();

  console.log(`\n📦 PackageID: ${pkgId}`);
  console.log(`👤 ${addr}`);

  // 铸币
  if (tcId) {
    console.log(`\n⏳ 铸币 ${supply} 个...`);
    try {
      const mintOut = run(
        `${SUI} client call --function mint --package ${pkgId} --module ${mod}` +
        ` --args ${tcId} ${supply}000000000 ${addr} --gas-budget 10000000`
      );
      console.log(mintOut);
      console.log("✅ 铸币成功！");
    } catch (e) { console.log("  ⚠️ 铸币失败，发布后手动铸币"); }
  }

  console.log(`\n🎉 完成！`);
  console.log(`https://suivision.xyz/package/${pkgId}`);
}

main().catch(e => console.error("❌", e.message));
