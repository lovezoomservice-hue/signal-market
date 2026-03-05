#!/bin/bash

# Signal Market - Cloudflare Pages/Workers 部署脚本

set -e

echo "🚀 Signal Market 部署脚本"
echo "=========================="

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查 wrangler
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}错误: wrangler 未安装${NC}"
    echo "运行: npm install -g wrangler"
    exit 1
fi

echo -e "${GREEN}✓ wrangler 已安装${NC}"

# 解析参数
ENV="${1:-preview}"
PROJECT_NAME="signal-market"

case "$ENV" in
    preview|dev)
        echo "📦 部署到 Preview 环境..."
        wrangler pages project create "$PROJECT_NAME" --production-branch=main 2>/dev/null || true
        wrangler pages deploy ./ui --project-name="$PROJECT_NAME" --branch=preview
        echo -e "${GREEN}✓ Preview 部署完成${NC}"
        ;;
    
    production|prod)
        echo "📦 部署到 Production 环境..."
        wrangler pages project create "$PROJECT_NAME" --production-branch=main 2>/dev/null || true
        wrangler pages deploy ./ui --project-name="$PROJECT_NAME" --branch=main
        echo -e "${GREEN}✓ Production 部署完成${NC}"
        ;;
    
    worker)
        echo "📦 部署 Worker..."
        wrangler deploy ./worker.js --env production
        echo -e "${GREEN}✓ Worker 部署完成${NC}"
        ;;
    
    all)
        echo "📦 部署全部 (Pages + Worker)..."
        wrangler pages project create "$PROJECT_NAME" --production-branch=main 2>/dev/null || true
        wrangler pages deploy ./ui --project-name="$PROJECT_NAME" --branch=main
        wrangler deploy ./worker.js --env production
        echo -e "${GREEN}✓ 全部部署完成${NC}"
        ;;
    
    *)
        echo "用法: $0 [preview|production|worker|all]"
        echo ""
        echo "  preview     - 部署到预览环境"
        echo "  production  - 部署到生产环境"
        echo "  worker      - 仅部署 Worker"
        echo "  all         - 部署 Pages 和 Worker"
        exit 1
        ;;
esac

echo ""
echo "🎉 部署完成!"
