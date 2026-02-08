#!/bin/bash

# Postiz 授权问题诊断脚本

echo "🔍 Postiz 授权问题诊断工具"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Docker 是否运行
echo "1️⃣ 检查 Docker 状态..."
if ! docker ps > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker 未运行，请先启动 Docker Desktop${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker 正在运行${NC}"
echo ""

# 检查服务状态
echo "2️⃣ 检查服务状态..."
docker compose ps
echo ""

# 检查 JWT_SECRET
echo "3️⃣ 检查 JWT_SECRET 配置..."
JWT_SECRET=$(docker compose exec -T postiz env 2>/dev/null | grep JWT_SECRET | cut -d'=' -f2- || echo "")
if [ -z "$JWT_SECRET" ]; then
    echo -e "${RED}❌ 无法获取 JWT_SECRET（容器可能未启动）${NC}"
elif [ "$JWT_SECRET" = "random string that is unique to every install - just type random characters here!" ]; then
    echo -e "${YELLOW}⚠️  JWT_SECRET 使用的是默认值，建议修改为随机字符串${NC}"
    echo "   生成新的 JWT_SECRET:"
    echo "   openssl rand -base64 32"
else
    JWT_LEN=${#JWT_SECRET}
    if [ $JWT_LEN -lt 32 ]; then
        echo -e "${YELLOW}⚠️  JWT_SECRET 长度较短（${JWT_LEN} 字符），建议至少 32 个字符${NC}"
    else
        echo -e "${GREEN}✅ JWT_SECRET 已配置（长度: ${JWT_LEN} 字符）${NC}"
    fi
fi
echo ""

# 检查数据库连接
echo "4️⃣ 检查数据库连接..."
if docker compose exec -T postiz-postgres psql -U postiz-user -d postiz-db-local -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 数据库连接正常${NC}"
    
    # 检查用户表
    USER_COUNT=$(docker compose exec -T postiz-postgres psql -U postiz-user -d postiz-db-local -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "0")
    if [ "$USER_COUNT" != "0" ]; then
        echo -e "${GREEN}   数据库中有 ${USER_COUNT} 个用户${NC}"
        
        # 检查未激活用户
        INACTIVE_COUNT=$(docker compose exec -T postiz-postgres psql -U postiz-user -d postiz-db-local -t -c "SELECT COUNT(*) FROM users WHERE activated = false;" 2>/dev/null | tr -d ' ' || echo "0")
        if [ "$INACTIVE_COUNT" != "0" ]; then
            echo -e "${YELLOW}   ⚠️  有 ${INACTIVE_COUNT} 个未激活的用户${NC}"
        fi
    else
        echo -e "${YELLOW}   ⚠️  数据库中没有用户，需要先注册${NC}"
    fi
else
    echo -e "${RED}❌ 数据库连接失败${NC}"
    echo "   检查数据库日志: docker compose logs postiz-postgres"
fi
echo ""

# 检查 Redis 连接
echo "5️⃣ 检查 Redis 连接..."
if docker compose exec -T postiz-redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis 连接正常${NC}"
else
    echo -e "${RED}❌ Redis 连接失败${NC}"
fi
echo ""

# 检查环境变量
echo "6️⃣ 检查关键环境变量..."
ENV_VARS=("MAIN_URL" "FRONTEND_URL" "DATABASE_URL" "REDIS_URL" "TEMPORAL_ADDRESS")
for VAR in "${ENV_VARS[@]}"; do
    VALUE=$(docker compose exec -T postiz env 2>/dev/null | grep "^${VAR}=" | cut -d'=' -f2- || echo "")
    if [ -z "$VALUE" ]; then
        echo -e "${RED}❌ ${VAR} 未设置${NC}"
    else
        echo -e "${GREEN}✅ ${VAR} 已设置${NC}"
    fi
done
echo ""

# 检查应用日志中的错误
echo "7️⃣ 检查最近的错误日志..."
ERRORS=$(docker compose logs postiz --tail 50 2>&1 | grep -i "error\|exception\|forbidden\|unauthorized" | tail -5 || echo "")
if [ -n "$ERRORS" ]; then
    echo -e "${YELLOW}⚠️  发现以下错误：${NC}"
    echo "$ERRORS" | while IFS= read -r line; do
        echo "   $line"
    done
else
    echo -e "${GREEN}✅ 未发现明显的错误信息${NC}"
fi
echo ""

# 检查 Stripe 配置
echo "8️⃣ 检查 Stripe 配置..."
STRIPE_SECRET=$(docker compose exec -T postiz env 2>/dev/null | grep STRIPE_SECRET_KEY | cut -d'=' -f2- || echo "")
if [ -n "$STRIPE_SECRET" ] && [ "$STRIPE_SECRET" != "" ]; then
    echo -e "${YELLOW}⚠️  Stripe 已配置，如果遇到授权错误，可能是订阅问题${NC}"
    echo "   如果不想使用 Stripe，请将 STRIPE_SECRET_KEY 设置为空"
else
    echo -e "${GREEN}✅ Stripe 未配置（使用免费模式）${NC}"
fi
echo ""

# 总结和建议
echo "📋 诊断总结"
echo "================================"
echo ""
echo "如果遇到授权错误，请尝试以下步骤："
echo ""
echo "1. 确保 JWT_SECRET 是随机字符串（至少 32 字符）"
echo "2. 检查数据库连接是否正常"
echo "3. 如果配置了 Stripe，确保有有效订阅或清空 Stripe 配置"
echo "4. 查看详细日志: docker compose logs -f postiz"
echo "5. 查看完整修复指南: cat AUTH_ERRORS_FIX.md"
echo ""
echo "快速修复命令："
echo "  # 生成新的 JWT_SECRET"
echo "  openssl rand -base64 32"
echo ""
echo "  # 重启服务"
echo "  docker compose restart postiz"
echo ""
echo "  # 查看实时日志"
echo "  docker compose logs -f postiz"
echo ""
