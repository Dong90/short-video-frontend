#!/bin/bash

# 修复 Docker 凭证配置

echo "🔧 修复 Docker 凭证配置..."

# 备份现有配置
if [ -f ~/.docker/config.json ]; then
    cp ~/.docker/config.json ~/.docker/config.json.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ 已备份现有配置"
fi

# 创建新配置（移除 credsStore）
cat > ~/.docker/config.json <<'EOF'
{
	"auths": {},
	"currentContext": "desktop-linux"
}
EOF

echo "✅ 已更新 Docker 配置"
echo ""
echo "⚠️  请重启 Docker Desktop 使配置生效"
echo ""
echo "💡 如果问题仍然存在，请："
echo "   1. 打开 Docker Desktop"
echo "   2. 进入 Settings > Resources > Advanced"
echo "   3. 取消勾选 'Use Docker Credential Helper'"
echo "   4. 点击 'Apply & Restart'"
