# 环境配置说明

## 一、配置位置

**在 short-video-frontend 根目录创建 `.env` 文件**，Docker Compose 会自动加载。

```bash
cd /Users/shixiaocai/Desktop/chuangye/duanju/github/short-video-frontend
cp .env.example .env
# 编辑 .env，填入需要的值
```

## 二、配置项说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `SHORT_VIDEO_API_URL` | 联调时 | short_video 后端地址，默认 `http://host.docker.internal:8000` |
| `YOUTUBE_CLIENT_ID` | 用 YouTube 时 | YouTube OAuth 客户端 ID |
| `YOUTUBE_CLIENT_SECRET` | 用 YouTube 时 | YouTube OAuth 客户端密钥 |
| `OPENAI_API_KEY` | 用 AI 功能时 | OpenAI API 密钥 |
| `OPENAI_BASE_URL` | 可选 | 自定义 API 地址（空则用官方） |

**不配置也能启动**，仅对应功能不可用。

## 三、从 postiz-app 复用配置

若在 postiz-app 已配置过，可先 source 再启动：

```bash
cd /Users/shixiaocai/Desktop/chuangye/duanju/github/postiz-app
source ./export-build-args.sh
cd ../short-video-frontend
docker compose up -d postiz
```

## 四、示例 .env

```env
SHORT_VIDEO_API_URL=http://host.docker.internal:8000
YOUTUBE_CLIENT_ID=你的YouTube客户端ID
YOUTUBE_CLIENT_SECRET=你的YouTube客户端密钥
OPENAI_API_KEY=sk-你的OpenAI密钥
OPENAI_BASE_URL=
```
