#!/bin/bash
# 导出 Postiz 常用 API 密钥（YouTube、OpenAI、X、TikTok、Cloudflare、short_video 等）
# 用法：source ./export-build-args.sh  或  . ./export-build-args.sh
# 若存在 .env，会优先从 .env 加载（建议 cp .env.example .env 并填入真实值）

[ -f .env ] && set -a && source .env && set +a

# YouTube（频道连接、发布）
export YOUTUBE_CLIENT_ID="${YOUTUBE_CLIENT_ID:-}"
export YOUTUBE_CLIENT_SECRET="${YOUTUBE_CLIENT_SECRET:-}"

# OpenAI（AI 功能）
export OPENAI_API_KEY="${OPENAI_API_KEY:-}"
export OPENAI_BASE_URL="${OPENAI_BASE_URL:-}"

# X / Twitter
export X_API_KEY="${X_API_KEY:-}"
export X_API_SECRET="${X_API_SECRET:-}"

# TikTok
export TIKTOK_CLIENT_ID="${TIKTOK_CLIENT_ID:-}"
export TIKTOK_CLIENT_SECRET="${TIKTOK_CLIENT_SECRET:-}"

# Cloudflare R2（存储头像等，STORAGE_PROVIDER=cloudflare 时必填）
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
export CLOUDFLARE_ACCESS_KEY="${CLOUDFLARE_ACCESS_KEY:-}"
export CLOUDFLARE_SECRET_ACCESS_KEY="${CLOUDFLARE_SECRET_ACCESS_KEY:-}"
export CLOUDFLARE_BUCKETNAME="${CLOUDFLARE_BUCKETNAME:-}"
export CLOUDFLARE_BUCKET_URL="${CLOUDFLARE_BUCKET_URL:-}"
export CLOUDFLARE_REGION="${CLOUDFLARE_REGION:-auto}"

# short_video 后端（联调必填）
# Docker 内访问宿主机：http://host.docker.internal:8000
# juhe 同网络：http://short_video_api:8000
export SHORT_VIDEO_API_URL="${SHORT_VIDEO_API_URL:-http://host.docker.internal:8000}"

# 其他常用平台（可选）
export LINKEDIN_CLIENT_ID="${LINKEDIN_CLIENT_ID:-}"
export LINKEDIN_CLIENT_SECRET="${LINKEDIN_CLIENT_SECRET:-}"
export REDDIT_CLIENT_ID="${REDDIT_CLIENT_ID:-}"
export REDDIT_CLIENT_SECRET="${REDDIT_CLIENT_SECRET:-}"
export GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:-}"
export GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET:-}"
export PINTEREST_CLIENT_ID="${PINTEREST_CLIENT_ID:-}"
export PINTEREST_CLIENT_SECRET="${PINTEREST_CLIENT_SECRET:-}"

echo "已导出 API 变量："
echo "  [YouTube]     YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET  ${YOUTUBE_CLIENT_ID:+✓}"
echo "  [OpenAI]      OPENAI_API_KEY, OPENAI_BASE_URL          ${OPENAI_API_KEY:+✓}"
echo "  [X]           X_API_KEY, X_API_SECRET                  ${X_API_KEY:+✓}"
echo "  [TikTok]      TIKTOK_CLIENT_ID, TIKTOK_CLIENT_SECRET   ${TIKTOK_CLIENT_ID:+✓}"
echo "  [Cloudflare]  CLOUDFLARE_* (6 个)                      ${CLOUDFLARE_ACCOUNT_ID:+✓}"
echo "  [short_video] SHORT_VIDEO_API_URL                      ${SHORT_VIDEO_API_URL:+✓}"
echo "  [其他]        LinkedIn, Reddit, GitHub, Pinterest       ${LINKEDIN_CLIENT_ID:+✓}"
