"""
Sui Token Creator - 编译 API
部署在服务器 61.164.252.247:8889
接受前端请求，编译 Move 代码，返回字节码
"""

from flask import Flask, request, jsonify
import subprocess, os, json, tempfile, shutil, re, hashlib

app = Flask(__name__)
SUI_BIN = "/usr/local/sui/sui"  # Sui CLI 路径

@app.route("/compile", methods=["POST"])
def compile_token():
    data = request.json
    name = data.get("name", "MyToken")
    symbol = data.get("symbol", "MTK")
    decimals = data.get("decimals", 9)
    supply = data.get("supply", "1000000000")
    desc = data.get("desc", name)
    icon_url = data.get("iconUrl", "")
    freeze_meta = data.get("freezeMeta", True)

    # 生成唯一模块名
    module_name = f"token_{hashlib.md5(f'{name}{symbol}'.encode()).hexdigest()[:6]}"

    # 生成合约代码
    icon_line = f'option::some(url::new_unsafe_from_bytes(b"{icon_url}"))' if icon_url else "option::none()"
    freeze_line = "transfer::public_freeze_object(metadata);" if freeze_meta else ""

    move_code = f'''#[allow(deprecated_usage)]
module {module_name}::{module_name} {{
    use std::option;
    use sui::coin::{{Self, Coin, TreasuryCap}};
    use sui::transfer;
    use sui::tx_context::{{Self, TxContext}};
    use sui::url;

    struct {symbol} has drop {{}}

    fun init(witness: {symbol}, ctx: &mut TxContext) {{
        let (treasury_cap, metadata) = coin::create_currency<{symbol}>(
            witness,
            {decimals},
            b"{symbol}",
            b"{name}",
            b"{desc}",
            {icon_line},
            ctx,
        );
        {freeze_line}
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }}

    public fun mint(cap: &mut TreasuryCap<{symbol}>, amount: u64, recipient: address, ctx: &mut TxContext) {{
        let coin = coin::mint(cap, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }}
}}
'''

    # 创建临时项目
    tmp_dir = tempfile.mkdtemp()
    sources_dir = os.path.join(tmp_dir, "sources")
    os.makedirs(sources_dir)

    # Move.toml
    with open(os.path.join(tmp_dir, "Move.toml"), "w") as f:
        f.write(f'[package]\nname = "{module_name}"\nversion = "1.0.0"\n[addresses]\n{module_name} = "0x0"\n')

    # Move 源码
    with open(os.path.join(sources_dir, f"{module_name}.move"), "w") as f:
        f.write(move_code)

    # 编译
    result = subprocess.run(
        [SUI_BIN, "move", "build", "--dump-bytecode"],
        cwd=tmp_dir,
        capture_output=True, text=True, timeout=120
    )

    # 编译输出
    build_dir = os.path.join(tmp_dir, "build", module_name)
    bytecode_path = os.path.join(build_dir, "bytecode_modules", f"{module_name}.mv")

    if os.path.exists(bytecode_path):
        with open(bytecode_path, "rb") as f:
            bytecode_b64 = base64.b64encode(f.read()).decode()

        # 返回字节码
        shutil.rmtree(tmp_dir)
        return jsonify({
            "success": True,
            "moduleName": module_name,
            "bytecode": bytecode_b64,
            "packageId": None,  # 浏览器发布后获得
        })
    else:
        shutil.rmtree(tmp_dir)
        return jsonify({
            "success": False,
            "error": result.stderr[:500],
        }), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8889)
