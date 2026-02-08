/**
 * Docker 环境下，容器内请求本应用 URL 需使用内部地址 (localhost:5000)
 * 否则 Next.js 图片优化会 ECONNREFUSED 127.0.0.1:4007
 *
 * 本地静态路径（/icons/、/logo 等）直接返回，避免 _next/image 在 Docker 内 fetch 失败导致 404
 */
export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  // 本地 public 下的静态资源（非 /uploads/）直接返回路径，由浏览器同源请求，避免 _next/image 404
  if (src.startsWith('/') && !src.startsWith('/uploads/') && !src.startsWith('http')) {
    return src;
  }

  const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL;
  const internalUrl =
    process.env.INTERNAL_FRONTEND_URL || process.env.NEXT_PUBLIC_INTERNAL_FRONTEND_URL;

  let fetchSrc = src;
  if (frontendUrl && internalUrl && src.startsWith(frontendUrl)) {
    fetchSrc = src.replace(frontendUrl, internalUrl);
  }
  // 同源 /uploads 路径：直接用内部地址，避免 build 时 NEXT_PUBLIC 未注入
  if (src.startsWith('/uploads/') && internalUrl) {
    fetchSrc = internalUrl + src;
  }

  return `/_next/image?url=${encodeURIComponent(fetchSrc)}&w=${width}&q=${quality || 75}`;
}
