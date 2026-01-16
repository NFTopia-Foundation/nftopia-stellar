import { useOptimizedFetch } from "./useOptimizedFetch";
import React from "react";

export function OptimizedFetchTestComponent({
  url,
  options,
}: {
  url: string;
  options?: any;
}) {
  const { data, error, loading } = useOptimizedFetch(url, options);
  return (
    <div>
      <div data-testid="loading">{loading ? "loading" : "not-loading"}</div>
      <div data-testid="error">{error ? "error" : "no-error"}</div>
      <div data-testid="data">{data ? JSON.stringify(data) : "no-data"}</div>
    </div>
  );
}
