@echo off
chcp 65001 >nul
title Sui Token Creator - 一键发币

echo ========================================
echo   Sui Token Creator - 一键发币
echo   主网 Mainnet
echo ========================================
echo.

:: 检查 Sui CLI
where sui >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [1/5] 下载 Sui CLI...
    curl -sL -o sui.zip "https://github.com/MystenLabs/sui/releases/download/mainnet-v1.76.1/sui-mainnet-v1.76.1-windows-x86_64.zip"
    powershell -Command "Expand-Archive -Path sui.zip -DestinationPath sui-bin -Force" >nul
    set "PATH=%CD%\sui-bin;%PATH%"
    echo ✅ Sui CLI 已下载
) else (
    echo ✅ Sui CLI 已安装
)

:: 检查钱包
sui client active-address >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 请先创建钱包: sui client new-address ed25519
    pause
    exit /b
)

:: 获取用户输入
set /p TOKEN_NAME=代币名称 (默认 MyToken):
if "%TOKEN_NAME%"=="" set TOKEN_NAME=MyToken

set /p TOKEN_SYMBOL=代币符号 (默认 MTK):
if "%TOKEN_SYMBOL%"=="" set TOKEN_SYMBOL=MTK

set /p DECIMALS=精度 (默认 9):
if "%DECIMALS%"=="" set DECIMALS=9

set /p SUPPLY=供应量 (默认 1000000000):
if "%SUPPLY%"=="" set SUPPLY=1000000000

set /p ICON_URL=头像 URL (可选):

set MODULE_NAME=token_%RANDOM%

:: 切换到主网
sui client switch --env mainnet 2>nul

echo.
echo [1/5] 创建项目...
mkdir %MODULE_NAME%\sources 2>nul
cd %MODULE_NAME%

:: 生成 Move.toml
echo [package] > Move.toml
echo name = "%MODULE_NAME%" >> Move.toml
echo version = "1.0.0" >> Move.toml
echo [addresses] >> Move.toml
echo %MODULE_NAME% = "0x0" >> Move.toml

:: 生成合约代码
set ICON_LINE=option::none()
if NOT "%ICON_URL%"=="" set ICON_LINE=option::some(url::new_unsafe_from_bytes(b"%ICON_URL%"))

(
echo #[allow(deprecated_usage)]
echo module %MODULE_NAME%::%MODULE_NAME% {
echo     use std::option;
echo     use sui::coin::{Self, Coin, TreasuryCap};
echo     use sui::transfer;
echo     use sui::tx_context::{Self, TxContext};
echo     use sui::url;
echo.
echo     struct %TOKEN_SYMBOL% has drop {}
echo.
echo     fun init(witness: %TOKEN_SYMBOL%, ctx: ^&mut TxContext) {
echo         let (treasury_cap, metadata) = coin::create_currency^<%TOKEN_SYMBOL%^>(
echo             witness,
echo             %DECIMALS%,
echo             b"%TOKEN_SYMBOL%",
echo             b"%TOKEN_NAME%",
echo             b"%TOKEN_NAME%",
echo             %ICON_LINE%,
echo             ctx,
echo         );
echo         transfer::public_freeze_object(metadata);
echo         transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
echo     }
echo.
echo     public fun mint(cap: ^&mut TreasuryCap^<%TOKEN_SYMBOL%^>, amount: u64, recipient: address, ctx: ^&mut TxContext) {
echo         let coin = coin::mint(cap, amount, ctx);
echo         transfer::public_transfer(coin, recipient);
echo     }
echo }
) > sources\%MODULE_NAME%.move

echo ✅ 合约代码已生成

:: 编译
echo.
echo [2/5] 编译合约...
sui move build
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 编译失败
    pause
    exit /b
)
echo ✅ 编译成功

:: 发布
echo.
echo [3/5] 发布到主网...
sui client publish --gas-budget 50000000 > publish_output.txt 2>&1
type publish_output.txt

:: 解析结果
for /f "tokens=2" %%a in ('findstr "PackageID:" publish_output.txt') do set PACKAGE_ID=%%a
for /f "tokens=2" %%a in ('findstr "TreasuryCap" publish_output.txt ^| findstr "0x"') do set TREASURY_ID=%%a

:: 如果没有找到 TreasuryCap 尝试其他格式
if "%TREASURY_ID%"=="" (
    for /f %%a in ('findstr /c:"TreasuryCap" publish_output.txt ^| findstr /i "0x[a-f0-9]"') do set TREASURY_ID=%%a
)

echo.
echo 📦 PackageID: %PACKAGE_ID%
echo 🔑 TreasuryCap: %TREASURY_ID%

:: 铸币
if NOT "%TREASURY_ID%"=="" (
    echo.
    echo [4/5] 铸币 %SUPPLY% 个到钱包...
    set MY_ADDR=
    for /f %%a in ('sui client active-address') do set MY_ADDR=%%a
    sui client call --function mint --package %PACKAGE_ID% --module %MODULE_NAME% --args %TREASURY_ID% %SUPPLY%000000000 %MY_ADDR% --gas-budget 10000000
    echo ✅ 铸币完成！
)

:: 完成
echo.
echo ========================================
echo   🎉 完成！
echo ========================================
echo.
echo PackageID: %PACKAGE_ID%
echo 查看: https://suivision.xyz/package/%PACKAGE_ID%
echo.

:: 回到上级目录
cd ..

pause
