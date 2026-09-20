import { useState, useCallback, useRef, useEffect } from 'react';
import { haptics } from '@/lib/haptics';
import { analyticsService } from '@/src/analytics/analytics.service';
import { errorLogger } from '@/src/errors/logger';

export interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  cooldown?: number; // milliseconds
  hapticFeedback?: boolean;
  trackAnalytics?: boolean;
  analyticsEvent?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface PullToRefreshState {
  isRefreshing: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  cooldownRemaining: number;
}

export function usePullToRefresh({
  onRefresh,
  cooldown = 2000,
  hapticFeedback = true,
  trackAnalytics = true,
  analyticsEvent = 'pull_to_refresh',
  onSuccess,
  onError,
}: PullToRefreshOptions): PullToRefreshState & {
  handleRefresh: () => Promise<void>;
  resetError: () => void;
  getLastUpdatedText: () => string;
  isInCooldown: () => boolean;
} {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  const lastRefreshTime = useRef<number>(0);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    // Check cooldown
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime.current;
    
    if (timeSinceLastRefresh < cooldown) {
      const remaining = Math.ceil((cooldown - timeSinceLastRefresh) / 1000);
      setCooldownRemaining(remaining);
      
      // Start cooldown timer
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
      
      cooldownTimerRef.current = setInterval(() => {
        const newRemaining = Math.ceil((cooldown - (Date.now() - lastRefreshTime.current)) / 1000);
        if (newRemaining <= 0) {
          setCooldownRemaining(0);
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
          }
        } else {
          setCooldownRemaining(newRemaining);
        }
      }, 1000);
      
      return;
    }

    // Trigger haptic feedback
    if (hapticFeedback) {
      await haptics.impact('medium');
    }

    setIsRefreshing(true);
    setError(null);

    // Track analytics
    if (trackAnalytics) {
      analyticsService.track(analyticsEvent, {
        timestamp: now,
        cooldownRemaining: 0,
      });
    }

    const startTime = Date.now();

    try {
      await onRefresh();
      
      // Update last refresh time
      lastRefreshTime.current = Date.now();
      setLastUpdated(new Date());
      setCooldownRemaining(0);
      
      // Track success
      if (trackAnalytics) {
        const duration = Date.now() - startTime;
        analyticsService.track(`${analyticsEvent}_success`, {
          duration,
          timestamp: Date.now(),
        });
      }
      
      // Call onSuccess callback
      if (onSuccess) {
        onSuccess();
      }
      
      // Trigger success haptic
      if (hapticFeedback) {
        await haptics.success();
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Refresh failed');
      setError(errorObj);
      
      // Track error
      if (trackAnalytics) {
        analyticsService.track(`${analyticsEvent}_error`, {
          error: errorObj.message,
          timestamp: Date.now(),
        });
      }
      
      // Call onError callback
      if (onError) {
        onError(errorObj);
      }
      
      // Trigger error haptic
      if (hapticFeedback) {
        await haptics.error();
      }
      
      errorLogger.log(errorObj, 'PullToRefresh');
    } finally {
      if (isMounted.current) {
        setIsRefreshing(false);
      }
    }
  }, [onRefresh, cooldown, hapticFeedback, trackAnalytics, analyticsEvent, onSuccess, onError]);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const getLastUpdatedText = useCallback(() => {
    if (!lastUpdated) return 'Never updated';
    
    const now = new Date();
    const diff = now.getTime() - lastUpdated.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds} seconds ago`;
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }, [lastUpdated]);

  const isInCooldown = useCallback(() => {
    return cooldownRemaining > 0;
  }, [cooldownRemaining]);

  return {
    isRefreshing,
    error,
    lastUpdated,
    cooldownRemaining,
    handleRefresh,
    resetError,
    getLastUpdatedText,
    isInCooldown,
  };
}