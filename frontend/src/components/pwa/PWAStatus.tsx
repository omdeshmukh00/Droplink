"use client";

import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function PWAStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    const handleOnline = () => {
      if (isOffline) {
        setIsOffline(false);
        setShowReconnected(true);
        const timer = setTimeout(() => setShowReconnected(false), 4000);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [isOffline]);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-amber-500 text-white font-medium text-xs rounded-full shadow-lg flex items-center gap-2"
        >
          <WifiOff className="w-4 h-4" />
          <span>You are currently offline. DropLink offline mode enabled.</span>
        </motion.div>
      )}

      {showReconnected && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white font-medium text-xs rounded-full shadow-lg flex items-center gap-2"
        >
          <Wifi className="w-4 h-4" />
          <span>Connection restored! You are back online.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
