#!/bin/bash
# 检查 idea 为 "Short video generated from Postiz" 的任务是否在生成中
# 用法：
#   ./scripts/check-postiz-task-status.sh [SHORT_VIDEO_BASE_URL]
# 默认请求 short_video 后端（可通过 SHORT_VIDEO_API_URL 或参数指定）

BASE="${1:-${SHORT_VIDEO_API_URL:-http://localhost:8000}}"
BASE="${BASE%/}"
TARGET="Short video generated from Postiz"

echo "=== 检查 Postiz 短视频任务状态 ==="
echo "short_video 后端: $BASE"
echo "查找 idea: \"$TARGET\""
echo ""

# 1. 正在生成中的任务
echo "1. 正在生成中的任务 (status=processing):"
PROC=$(curl -s "$BASE/api/v1/tasks?status=processing&limit=50")
if echo "$PROC" | grep -q '"tasks":\s*\['; then
  echo "$PROC" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for t in d.get('tasks',[]):
    idea=(t.get('idea') or '')[:50]
    print(f\"   任务 {t['id']}: status={t['status']} | idea=\"{idea}...\"\")
" 2>/dev/null || echo "   $PROC" | head -5
else
  echo "   无 processing 任务"
fi

echo ""
echo "2. 最近任务（含 Postiz 默认 idea 的）:"
ALL=$(curl -s "$BASE/api/v1/tasks?limit=20")
echo "$ALL" | python3 -c "
import json,sys
d=json.load(sys.stdin)
found=False
for t in d.get('tasks',[]):
    idea=(t.get('idea') or '')[:60]
    if 'Short video generated from Postiz' in idea or 'short video generated' in idea.lower():
        found=True
        st=t.get('status','?')
        icon='🔄' if st=='processing' else '✅' if st=='completed' else '⏳' if st=='pending' else '❌'
        print(f\"   {icon} {t['id']}: status={st} | idea=\"{idea}\"\")
if not found:
    print('   未找到 idea 包含 \"Short video generated from Postiz\" 的任务')
    for t in (d.get('tasks',[]) or [])[:3]:
        print(f\"   示例: {t.get('id')} status={t.get('status')} idea=\"{((t.get('idea') or '')[:40])}\"\")
" 2>/dev/null || echo "   (需 python3)"
echo ""
echo "状态说明: processing=生成中, pending=排队中, completed=已完成, failed=失败"
