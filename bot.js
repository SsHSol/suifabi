/**
 * Sui 发币 Telegram 机器人
 * 调用 GitHub 仓库中的 deploy.js 发币
 * 用法: set BOT_TOKEN=xxx && node bot.js
 */
const TelegramBot = require('node-telegram-bot-api');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ====== 配置 ======
const BOT_TOKEN = process.env.BOT_TOKEN || ''; // 从 @BotFather 获取
const REPO_URL = 'https://github.com/SsHSol/suifabi.git'; // 你的发币仓库
const WORK_DIR = path.join(__dirname, 'bot_work'); // 工作目录
const SUI = 'C:\\Users\\z\\sui\\bin\\sui.exe';

if (!BOT_TOKEN) {
  console.log('❌ 请设置 BOT_TOKEN 环境变量');
  console.log('   set BOT_TOKEN=你的token');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ====== 拉取最新代码 ======
async function syncRepo() {
  if (!fs.existsSync(WORK_DIR)) {
    // 首次克隆
    execSync(`git clone ${REPO_URL} "${WORK_DIR}"`, { encoding: 'utf-8', shell: true });
  } else {
    // 拉取更新
    try {
      execSync(`cd "${WORK_DIR}" && git pull`, { encoding: 'utf-8', shell: true });
    } catch (_) {}
  }
}

// ====== 调用 deploy.js 发币 ======
async function createToken(name, symbol, imagePath, chatId) {
  await bot.sendMessage(chatId, `🚀 开始发币 ${name} (${symbol})...`);

  try {
    await syncRepo();

    // 检查依赖
    const deployPath = path.join(WORK_DIR, 'deploy.js');
    if (!fs.existsSync(deployPath)) {
      await bot.sendMessage(chatId, '❌ 仓库里没有 deploy.js');
      return;
    }

    if (!fs.existsSync(path.join(WORK_DIR, 'node_modules'))) {
      execSync(`cd "${WORK_DIR}" && npm install axios form-data`, { encoding: 'utf-8', shell: true });
    }

    // 设置 Sui CLI 路径
    process.env.SUI = SUI;

    // 执行发币
    const cmd = `node "${deployPath}" "${name}" "${symbol}" 9 1000000000 "${imagePath || ''}"`;
    execSync(cmd, { encoding: 'utf-8', shell: true, timeout: 180000, stdio: 'inherit' });

    await bot.sendMessage(chatId, '✅ 发币成功！见上方日志');
  } catch (e) {
    await bot.sendMessage(chatId, `❌ 失败: ${e.message?.substring(0, 200)}`);
  }
}

// ====== 命令处理 ======
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '🤖 Sui 发币机器人\n\n' +
    '命令:\n' +
    '/create <名称> <符号> - 发币\n' +
    '例: /create MyToken MTK\n\n' +
    '或发送图片 + 文字:\n' +
    'MyToken MTK'
  );
});

bot.onText(/\/create (.+)/, (msg, match) => {
  const parts = match[1].trim().split(/\s+/);
  const name = parts[0] || 'MyToken';
  const symbol = parts[1] || name.toUpperCase();
  createToken(name, symbol, null, msg.chat.id);
});

// 图片处理：发图+文字发币
bot.on('photo', async (msg) => {
  if (msg.caption) {
    const parts = msg.caption.trim().split(/\s+/);
    const name = parts[0] || 'MyToken';
    const symbol = parts[1] || name.toUpperCase();
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const tmpPath = path.join(__dirname, `tmp_${Date.now()}.png`);
    await bot.downloadFile(fileId, tmpPath);
    createToken(name, symbol, tmpPath, msg.chat.id);
  }
});

console.log('🤖 Sui 发币机器人已启动');
console.log(`  工作目录: ${WORK_DIR}`);
