import { FC, useEffect, useState } from 'react';
import Image from 'next/image';
interface ImageSrc {
  src: string;
  fallbackSrc: string;
  width: number;
  height: number;
  [key: string]: any;
}
const ImageWithFallback: FC<ImageSrc> = (props) => {
  const { src, fallbackSrc, ...rest } = props;
  const [imgSrc, setImgSrc] = useState(src);
  useEffect(() => {
    if (src !== imgSrc) {
      setImgSrc(src);
    }
  }, [src]);
  // /uploads/ 同源图片：跳过 Next.js 优化，由浏览器直接加载，避免服务端 fetch localhost:5000 404
  const isUploads = (typeof imgSrc === 'string' && imgSrc.includes('/uploads/'));
  return (
    <Image
      alt=""
      {...rest}
      unoptimized={isUploads}
      src={imgSrc}
      onError={() => {
        // [DEBUG] 定位头像不显示根因：若看到此日志，说明图片加载失败
        if (typeof window !== 'undefined' && (src?.includes?.('upload') || src?.includes?.('uploads'))) {
          // eslint-disable-next-line no-console
          console.warn('[ImageWithFallback] 图片加载失败:', { src, fallbackSrc });
        }
        setImgSrc(fallbackSrc);
      }}
    />
  );
};
export default ImageWithFallback;
