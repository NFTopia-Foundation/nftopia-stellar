"use client";

import React from 'react';
import OptimizedImage, { OptimizedImageProps } from './OptimizedImage';

export default function ImageWithFallback(props: OptimizedImageProps) {
  return <OptimizedImage {...props} />;
}
