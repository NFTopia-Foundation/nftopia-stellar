import { useDebounce } from "./useDebounce";
import React from "react";

export function DebounceTestComponent({
  value,
  delay,
  immediate,
}: {
  value: string;
  delay?: number;
  immediate?: boolean;
}) {
  const debounced = useDebounce(value, delay, { immediate });
  return <div data-testid="debounced">{debounced}</div>;
}
