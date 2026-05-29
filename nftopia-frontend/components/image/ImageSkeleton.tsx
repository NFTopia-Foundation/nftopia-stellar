import React from 'react';

export default function ImageSkeleton({ width, height, className = '' }: { width?: number | string; height?: number | string; className?: string }) {
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      role="status"
      aria-busy="true"
      className={`bg-gray-800 animate-pulse rounded-md ${className}`}
      style={style}
    />
  );
}
