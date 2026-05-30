import React from 'react';
import { useAuthImage } from '../../hooks/useAuthImage';

type AuthImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string | null | undefined;
};

export function AuthImage({ src, alt, ...props }: AuthImageProps) {
  const resolvedSrc = useAuthImage(src);
  if (!resolvedSrc) return null;
  return <img src={resolvedSrc} alt={alt} {...props} />;
}
