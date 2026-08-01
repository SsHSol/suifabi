@echo off
chcp 65001 >nul
title Sui 新币监控
cd /d C:\Users\z\sui-token-creator

:: 设置代理
set HTTPS_PROXY=http://127.0.0.1:7897
set HTTP_PROXY=http://127.0.0.1:7897

echo ========================================
echo   Sui 新币监控启动
echo   按 Ctrl+C 停止
echo ========================================

node monitor.mjs
pause
