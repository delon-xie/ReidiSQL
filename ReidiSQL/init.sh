#!/bin/bash

# ReidiSQL 项目初始化脚本
# 用途：一键安装依赖并启动开发环境

set -e

echo "========================================="
echo "  ReidiSQL 项目初始化"
echo "========================================="
echo ""

# 检查 Node.js
echo "📦 检查 Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js 已安装: $NODE_VERSION"
    
    # 检查版本是否 >= 22
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 22 ]; then
        echo "⚠️  警告: Node.js 版本过低，需要 22+"
        echo "   当前版本: $NODE_VERSION"
        echo "   请升级到 Node.js 22 LTS"
        echo "   下载地址: https://nodejs.org/"
        exit 1
    fi
else
    echo "❌ 未找到 Node.js，请先安装 Node.js 22 LTS"
    echo "   下载地址: https://nodejs.org/"
    exit 1
fi

# 检查 Rust
echo "📦 检查 Rust..."
if command -v rustc &> /dev/null; then
    RUST_VERSION=$(rustc --version)
    echo "✅ Rust 已安装: $RUST_VERSION"
else
    echo "❌ 未找到 Rust，请先安装 Rust 1.75+"
    echo "   下载地址: https://rustup.rs/"
    exit 1
fi

echo ""
echo "========================================="
echo "  安装依赖"
echo "========================================="
echo ""

# 安装根依赖
echo "📦 安装根项目依赖..."
npm install
echo ""

# 安装前端依赖
echo "📦 安装前端依赖..."
cd frontend
npm install
cd ..
echo ""

# 安装后端依赖
echo "📦 安装 Node.js 后端依赖..."
cd node-backend
npm install
cd ..
echo ""

# 配置环境变量
echo "========================================="
echo "  配置环境变量"
echo "========================================="
echo ""

if [ ! -f node-backend/.env ]; then
    echo "📝 创建 .env 文件..."
    cp node-backend/.env.example node-backend/.env
    echo "✅ 已创建 node-backend/.env"
    echo "⚠️  请编辑该文件配置数据库连接信息"
else
    echo "✅ node-backend/.env 已存在"
fi

echo ""
echo "========================================="
echo "  安装完成！"
echo "========================================="
echo ""
echo "📋 下一步："
echo ""
echo "1️⃣  配置数据库连接信息："
echo "   vim node-backend/.env"
echo ""
echo "2️⃣  启动开发环境："
echo "   npm run dev"
echo ""
echo "3️⃣  或分别启动服务："
echo "   # 终端 1: 前端"
echo "   cd frontend && npm run dev"
echo ""
echo "   # 终端 2: Node.js 后端"
echo "   cd node-backend && npm run dev"
echo ""
echo "   # 终端 3: Tauri 应用"
echo "   cd src-tauri && cargo tauri dev"
echo ""
echo "📖 更多信息请查看："
echo "   - README.md"
echo "   - 脚手架完成报告.md"
echo "   - docs/README.md"
echo ""
echo "========================================="
