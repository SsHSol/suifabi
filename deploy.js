/**
 * Sui 一键发币 - 本地脚本
 * 用法: node deploy.js <名称> <符号> [精度] [供应量] [图片路径]
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
const FormData = require("form-data");

const SUI = "C:\\Users\\z\\sui\\bin\\sui.exe";
const PINATA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJiMmE3YzZhNi0zNDRkLTRjZjYtYTE3NC0yMjRiY2RlYmZhNmYiLCJlbWFpbCI6InNzaHp1aUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiOTdlMWFlYjIzZWU1MDA2NDY5MmUiLCJzY29wZWRLZXlTZWNyZXQiOiI3YWUxZWNhZTc2OTJiZjE3NTg0NGFmNDUzMWViZmZhYzRhNDI3YTFjN2MwNDhkMzc2OTc0NzBmMWU3MzU2ZjcwIiwiZXhwIjoxODE2OTU5MzYwfQ.UGLnVpJxDyAuAvLKu0jYOUJb7w1KPF_gzmUjf6stFwA";

function run(cmd) { return execSync(cmd, { encoding: "utf-8", stdio: "pipe", shell: true }).trim(); }

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
  const [name = "MyToken", symbol = "MTK", decimals = "9", supply = "1000000000", imagePath = ""] = process.argv.slice(2);
  const raw = crypto.randomBytes(4).toString("hex");
  const mod = "t" + raw;   // 模块名（小写）
  const otw = ("t" + raw).toUpperCase();   // 见证类型（全大写，必须匹配模块名大写）

  // 处理头像：本地文件→上传IPFS；网络URL→直接使用
  let iconUrl = "";
  if (imagePath) {
    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      iconUrl = imagePath;
      console.log(`🖼️ 使用网络图片: ${iconUrl}`);
    } else if (fs.existsSync(imagePath)) {
      iconUrl = await uploadImage(imagePath);
    } else {
      console.log(`⚠️ 图片不存在: ${imagePath}`);
    }
  }
  if (!iconUrl) console.log("⏭️ 无头像");

  const iconLine = iconUrl ? `option::some(url::new_unsafe_from_bytes(b"${iconUrl}"))` : "option::none()";

  // 创建项目
  console.log("\n📁 创建项目...");
  const dir = path.join(__dirname, mod);
  fs.mkdirSync(path.join(dir, "sources"), { recursive: true });
  fs.writeFileSync(path.join(dir, "Move.toml"),
    `[package]\nname = "${mod}"\nversion = "1.0.0"\n[addresses]\n${mod} = "0x0"\n`);

  const moveCode =
    `#[allow(deprecated_usage)]\nmodule ${mod}::${mod} {\n` +
    `    use std::option;\n    use sui::coin::{Self, Coin, TreasuryCap};\n` +
    `    use sui::transfer;\n    use sui::tx_context::{Self, TxContext};\n` +
    `    use sui::url;\n\n    struct ${otw} has drop {}\n\n` +
    `    fun init(witness: ${otw}, ctx: &mut TxContext) {\n` +
    `        let (treasury_cap, metadata) = coin::create_currency<${otw}>(\n` +
    `            witness,\n            ${decimals},\n            b"${symbol}",\n            b"${name}",\n            b"${name}",\n            ${iconLine},\n            ctx,\n        );\n` +
    `        transfer::public_freeze_object(metadata);\n` +
    `        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));\n    }\n` +
    `    public fun mint(cap: &mut TreasuryCap<${otw}>, amount: u64, recipient: address, ctx: &mut TxContext) {\n` +
    `        let coin = coin::mint(cap, amount, ctx);\n        transfer::public_transfer(coin, recipient);\n    }\n}\n`;

  fs.writeFileSync(path.join(dir, "sources", `${mod}.move`), moveCode);
  console.log(`  ✅ 项目: ${dir}\n  名称: ${name}\n  符号: ${symbol}`);

  // 切主网
  run(`${SUI} client switch --env mainnet`);
  console.log("🌐 主网");

  // 编译
  console.log("\n🔨 编译...");
  const build = execSync(`cd "${dir}" && ${SUI} move build`, { encoding: "utf-8", stdio: "pipe", shell: true });
  console.log("  ✅ 编译成功");

  // 发布
  console.log("\n🚀 发布到主网...");
  const out = execSync(`${SUI} client publish "${dir}" --gas-budget 50000000`, { encoding: "utf-8", stdio: "pipe", shell: true });
  console.log(out);

  // 解析结果
  const pkgId = (out.match(/PackageID:\s*(0x[a-f0-9]+)/) || [])[1];
  const tcId = (out.match(new RegExp(`TreasuryCap<[^>]*${otw}[^>]*>\\s*(0x[a-f0-9]+)`)) || [])[1];
  const addr = run(`${SUI} client active-address`).split("\n").filter(l => l.startsWith("0x")).pop() || "";

  console.log(`\n📦 PackageID: ${pkgId}`);
  console.log(`👤 ${addr}`);

  if (tcId) {
    console.log(`⏳ 铸币 ${supply} 个到钱包...`);
    const mint = execSync(
      `${SUI} client call --function mint --package ${pkgId} --module ${mod}` +
      ` --args ${tcId} ${supply}000000000 ${addr} --gas-budget 10000000`,
      { encoding: "utf-8", stdio: "pipe", shell: true }
    );
    console.log(mint.split("\n").slice(-3).join("\n"));
    console.log("✅ 铸币成功！");
  }

  console.log(`\n🎉 完成！\nhttps://suivision.xyz/package/${pkgId}`);
}

main().catch(e => console.error("❌", e.message));
