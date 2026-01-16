'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const response = await fetch('/', { method: 'HEAD' });
      if (response.ok) {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    if (isOnline) {
      window.location.href = '/';
    }
  }, [isOnline]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center text-white">
        <div className="mb-6">
          {isOnline ? (
            <Wifi className="w-16 h-16 mx-auto text-green-400" />
          ) : (
            <WifiOff className="w-16 h-16 mx-auto text-red-400" />
          )}
        </div>
        
        <h1 className="text-2xl font-bold mb-4">
          {isOnline ? 'Connection Restored!' : 'You\'re Offline'}
        </h1>
        
        <p className="text-gray-300 mb-6">
          {isOnline
            ? 'Great! Your internet connection has been restored.'
            : 'It looks like you\'re not connected to the internet. Check your connection and try again.'}
        </p>
        
        <div className="space-y-4">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isRetrying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </button>
          
          <div className="text-sm text-gray-400">
            <p>While offline, you can still:</p>
            <ul className="mt-2 space-y-1">
              <li>• View cached NFT collections</li>
              <li>• Browse your saved favorites</li>
              <li>• Access your profile information</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}