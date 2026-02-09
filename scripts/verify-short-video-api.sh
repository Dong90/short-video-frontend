#!/bin/bash
# 验证 short-video 创建平台账号、更新平台账号 接口是否成功
# 用法：
#   ./scripts/verify-short-video-api.sh [SHORT_VIDEO_BASE_URL]
# 默认 SHORT_VIDEO_BASE_URL=http://localhost:8000（short_video 后端）
# 需要 Postiz 已启动在 4007，且 SHORT_VIDEO_API_URL 指向 short_video

set -e
BASE="${1:-http://localhost:8000}"
POSTIZ="${POSTIZ_URL:-http://localhost:4007}"
echo "=== 验证 short-video 接口 ==="
echo "short_video 后端: $BASE"
echo "Postiz 前端: $POSTIZ"
echo ""

# 1. 直接调用 short_video 创建平台账号
echo "1. 测试 short_video 创建平台账号 (POST $BASE/api/v1/platform-accounts)"
CREATE_RES=$(curl -s -X POST "$BASE/api/v1/platform-accounts" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "verify_test_account",
    "platform": "youtube",
    "status": "active",
    "config": {
      "platform": "youtube",
      "postiz": {"organization_id": "test-org", "integration_id": "verify-integration-123"},
      "avatar_url": "https://example.com/avatar.png"
    }
  }' -w "\n%{http_code}")
HTTP_CODE=$(echo "$CREATE_RES" | tail -n1)
BODY=$(echo "$CREATE_RES" | sed '$d')
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ 创建成功 (HTTP $HTTP_CODE)"
  ACC_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$ACC_ID" ]; then
    echo "   账号 ID: $ACC_ID"
    
    # 2. 测试 integration_id 过滤
    echo ""
    echo "2. 测试 integration_id 过滤 (GET $BASE/api/v1/platform-accounts?integration_id=verify-integration-123)"
    LIST_RES=$(curl -s "$BASE/api/v1/platform-accounts?integration_id=verify-integration-123&limit=5" -w "\n%{http_code}")
    LIST_HTTP=$(echo "$LIST_RES" | tail -n1)
    LIST_BODY=$(echo "$LIST_RES" | sed '$d')
    if [ "$LIST_HTTP" = "200" ]; then
      ITEMS=$(echo "$LIST_BODY" | grep -o '"items":\[.*\]' | sed 's/"items":\[//' | sed 's/\]$//')
      if echo "$LIST_BODY" | grep -q "verify_test_account"; then
        echo "   ✅ 按 integration_id 过滤成功"
      else
        echo "   ⚠️  返回 200 但未找到匹配账号（可能 config 格式需检查）"
      fi
    else
      echo "   ❌ 列表失败 HTTP $LIST_HTTP"
    fi
    
    # 3. 测试更新平台账号
    echo ""
    echo "3. 测试更新平台账号 (PUT $BASE/api/v1/platform-accounts/$ACC_ID)"
    UPDATE_RES=$(curl -s -X PUT "$BASE/api/v1/platform-accounts/$ACC_ID" \
      -H "Content-Type: application/json" \
      -d "{
        \"name\": \"verify_test_account_updated\",
        \"config\": {
          \"postiz\": {\"organization_id\": \"test-org\", \"integration_id\": \"verify-integration-123\"},
          \"avatar_url\": \"https://example.com/avatar2.png\"
        }
      }" -w "\n%{http_code}")
    UPDATE_HTTP=$(echo "$UPDATE_RES" | tail -n1)
    if [ "$UPDATE_HTTP" = "200" ]; then
      echo "   ✅ 更新成功 (HTTP $UPDATE_HTTP)"
    else
      echo "   ❌ 更新失败 HTTP $UPDATE_HTTP"
    fi
    
    # 清理：删除测试账号
    echo ""
    echo "4. 清理测试账号 (DELETE $BASE/api/v1/platform-accounts/$ACC_ID)"
    DEL_RES=$(curl -s -X DELETE "$BASE/api/v1/platform-accounts/$ACC_ID" -w "%{http_code}")
    if [ "$DEL_RES" = "200" ] || echo "$DEL_RES" | tail -c 4 | grep -q "200"; then
      echo "   ✅ 已删除"
    fi
  fi
else
  echo "   ❌ 创建失败 HTTP $HTTP_CODE"
  echo "   响应: $BODY"
fi

echo ""
echo "=== 通过 Postiz 代理验证（需已登录）==="
echo "如需验证 Postiz 添加频道时自动创建："
echo "  1. 在 Postiz 连接 YouTube 频道"
echo "  2. 检查 short_video 日志或数据库 platform_accounts 表"
echo ""
echo "如需验证保存短视频配置时更新平台账号："
echo "  1. 在 Postiz 打开短视频弹窗 -> 账号配置"
echo "  2. 选择平台账号后保存"
echo "  3. 检查 short_video platform_account 的 config 是否更新"
echo ""
