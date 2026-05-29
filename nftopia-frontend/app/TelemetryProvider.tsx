'use client';

import { useTelemetry } from '@/hooks/useTelemetry';

export default function TelemetryProvider() {
  useTelemetry();
  return null;
}