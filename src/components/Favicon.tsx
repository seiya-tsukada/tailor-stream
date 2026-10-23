import React from 'react';
import { Globe } from 'lucide-react';

interface FaviconProps {
  src: string;
  alt: string;
  containerClassName: string;
  imageClassName: string;
  fallbackIconClassName: string;
  lazy?: boolean;
}

// サイトのファビコン（読み込み失敗時は非表示、URL がなければ地球アイコン）
export const Favicon: React.FC<FaviconProps> = ({
  src,
  alt,
  containerClassName,
  imageClassName,
  fallbackIconClassName,
  lazy = false,
}) => (
  <div className={containerClassName}>
    {src ? (
      <img
        src={src}
        alt={alt}
        className={imageClassName}
        loading={lazy ? 'lazy' : undefined}
        referrerPolicy="no-referrer"
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    ) : (
      <Globe className={fallbackIconClassName} />
    )}
  </div>
);
