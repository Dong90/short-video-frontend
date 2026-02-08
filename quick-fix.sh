#!/bin/bash

# Docker 凭证问题快速修复脚本

set -e

echo "🔧 Docker 凭证问题快速修复"
echo ""

# 检查 Docker 是否运行
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker 未运行，请先启动 Docker Desktop"
    exit 1
fi

# 备份配置
if [ -f ~/.docker/config.json ]; then
    BACKUP_FILE=~/.docker/config.json.backup.$(date +%Y%m%d_%H%M%S)
    cp ~/.docker/config.json "$BACKUP_FILE"
    echo "✅ 已备份配置到: $BACKUP_FILE"
fi

# 创建修复后的配置
mkdir -p ~/.docker
cat > ~/.docker/config.json <<'EOF'
{
	"auths": {},
	"currentContext": "desktop-linux"
}
EOF

echo "✅ 已更新 Docker 配置"
echo ""
echo "⚠️  重要：请重启 Docker Desktop 使配置生效"
echo ""
echo "📋 下一步："
echo "   1. 完全退出 Docker Desktop（不是最小化）"
echo "   2. 重新启动 Docker Desktop"
echo "   3. 等待 Docker 完全启动"
echo "   4. 运行测试: docker pull hello-world"
echo ""
echo "💡 如果问题仍然存在，请："
echo "   1. 打开 Docker Desktop"
echo "   2. Settings > Resources > Advanced"
echo "   3. 取消勾选 'Use Docker Credential Helper'"
echo "   4. 点击 'Apply & Restart'"
