'use client';

import { useEffect, useState, useRef } from 'react';

export default function UpdateToast() {
  const [showUpdate, setShowUpdate] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Function to check for updates and show banner
    const checkForUpdate = async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        registrationRef.current = registration;
        // Check if there's a waiting service worker
        if (registration.waiting) {
          setShowUpdate(true);
        }
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            const handleStateChange = () => {
              if (installingWorker.state === 'installed') {
                // There is a new update waiting
                setShowUpdate(true);
              }
            };
            installingWorker.addEventListener('statechange', handleStateChange);
            // Cleanup on unmount
            return () => {
              installingWorker.removeEventListener('statechange', handleStateChange);
            };
          }
        });
        // Also listen for controllerchange to know when update has been applied
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // A new service worker has taken control, we can hide the banner
          setShowUpdate(false);
        });
      }
    };

    // Initial check
    checkForUpdate();

    // Cleanup
    return () => {
      if (registrationRef.current) {
        registrationRef.current = null;
      }
    };
  }, []);

  const handleUpdate = async () => {
    const registration = registrationRef.current;
    if (registration?.waiting) {
      // Skip the waiting service worker to activate it
      // @ts-ignore: skipWaiting exists on ServiceWorkerRegistration but may not be in the type definition
      registration.skipWaiting();
    }
    // Reload the page to get the new version
    window.location.reload();
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-center pointer-events-auto">
      <div
        className="flex items-center gap-3 p-4 rounded-lg border bg-black/90 backdrop-blur-sm max-w-sm shadow-lg text-white"
      >
        <p className="text-sm font-medium flex-1">
          Update available — refresh to get the latest version
        </p>
        <button
          onClick={handleUpdate}
          className="flex-shrink-0 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition-colors"
        >
          Reload
        </button>
      </div>
    </div>
  );
}