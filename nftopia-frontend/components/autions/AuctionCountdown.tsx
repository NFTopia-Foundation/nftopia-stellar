import React, { useState, useEffect, useMemo } from 'react';

interface AuctionCountdownProps {
  endTime: string;       // ISO string or timestamp from backend
  serverTimeOnMount: string; // Server time reference string
  onAuctionEnd?: () => void;
}

export const AuctionCountdown: React.FC<AuctionCountdownProps> = ({
  endTime,
  serverTimeOnMount,
  onAuctionEnd,
}) => {
  // 1. Calculate clock drift correction factor on mount
  const clockOffset = useMemo(() => {
    const serverMs = new Date(serverTimeOnMount).getTime();
    const clientMs = Date.now();
    return serverMs - clientMs; // Add this to Date.now() to mirror server time
  }, [serverTimeOnMount]);

  const targetTime = useMemo(() => new Date(endTime).getTime(), [endTime]);

  const calculateTimeLeft = (): number => {
    const correctedCurrentTime = Date.now() + clockOffset;
    return Math.max(0, targetTime - correctedCurrentTime);
  };

  const [msRemaining, setMsRemaining] = useState<number>(calculateTimeLeft);

  useEffect(() => {
    if (msRemaining <= 0) return;

    const intervalId = setInterval(() => {
      const timeLeft = calculateTimeLeft();
      setMsRemaining(timeLeft);

      if (timeLeft <= 0) {
        clearInterval(intervalId);
        if (onAuctionEnd) onAuctionEnd();
      }
    }, 1000);

    // Required Change: Prevent memory leaks via interval cleanup mapping
    return () => clearInterval(intervalId);
  }, [targetTime, clockOffset]);

  // 2. Formatting Engine
  const formatTime = (totalMs: number): string => {
    if (totalMs <= 0) return '00:00:00';

    const totalSeconds = Math.floor(totalMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num: number) => String(num).padStart(2, '0');

    // Return MM:SS format if less than 1 hour remains
    if (hours === 0) {
      return `${pad(minutes)}:${pad(seconds)}`;
    }

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  // 3. Dynamic Urgency Styling Evaluation
  const totalSecondsRemaining = msRemaining / 1000;
  const isEnded = msRemaining <= 0;
  const isUnderOneMinute = !isEnded && totalSecondsRemaining < 60;
  const isUnderTenMinutes = !isEnded && totalSecondsRemaining < 600;

  let textClass = 'text-gray-900 font-mono font-bold';
  if (isEnded) textClass = 'text-red-600 font-semibold';
  else if (isUnderOneMinute) textClass = 'text-red-500 font-mono font-bold animate-pulse';
  else if (isUnderTenMinutes) textClass = 'text-amber-500 font-mono font-bold';

  return (
    <div className="flex items-center space-x-1.5">
      <span className={textClass}>
        {isEnded ? 'Auction Ended' : formatTime(msRemaining)}
      </span>
    </div>
  );
};

// Skeleton Loader placeholder while data stream loads
export const CountdownSkeleton: React.FC = () => (
  <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
);