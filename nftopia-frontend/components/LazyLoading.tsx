'use client'
import { useEffect, useState, useRef, ReactNode } from 'react';

type LazyLoaderProps = {
    children: ReactNode
}

const LazyLoader = ({ children }: LazyLoaderProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px' }
    );

    if (ref.current) observer.observe(ref.current);
    
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{isVisible ? children : null}</div>;
};

export default LazyLoader;