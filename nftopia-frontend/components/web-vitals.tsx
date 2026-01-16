'use client'
 
import { useReportWebVitals } from 'next/web-vitals'
 
export function WebVitals() {
  useReportWebVitals((metric) => {
    switch (metric.name) {
        case 'FCP': {
            console.log('First Contentful Paint:', metric.value);
            break;
          }
          case 'LCP': {
            console.log('Largest Contentful Paint:', metric.value);
            break;
        }
    }
  })

  return null;
}