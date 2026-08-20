"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { usePWA } from '@/hooks/usePWA';
import { Download, X, Share, PlusSquare, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function InstallPrompt() {
  const { isInstallable, isInstalled, isIOS, isStandalone, promptInstall } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed prompt in this session
    const isDismissed = sessionStorage.getItem('droplink_pwa_dismissed');
    if (isDismissed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('droplink_pwa_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      const success = await promptInstall();
      if (success) {
        handleDismiss();
      }
    }
  };

  // Don't show if already installed, in standalone mode, or dismissed
  if (isStandalone || isInstalled || dismissed) {
    return null;
  }

  // Show if installable or if on iOS
  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="fixed bottom-5 right-5 left-5 sm:left-auto sm:max-w-md z-50 pointer-events-auto"
      >
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-2xl rounded-3xl p-5 text-slate-900 overflow-hidden relative group">
          {/* Subtle Accent Glow */}
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-start gap-4">
            {/* App Icon */}
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-md flex-shrink-0">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center overflow-hidden">
                <Image
                  src="/DropLink-logo.png"
                  alt="DropLink PWA Logo"
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 mb-0.5">
                <Sparkles className="w-3.5 h-3.5 fill-blue-600/20" />
                <span>PWA App Available</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 leading-snug">
                Install DropLink App
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Add to your home screen for instant peer-to-peer file transfers and offline support.
              </p>
            </div>

            {/* Dismiss Button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Dismiss PWA prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs py-2.5 px-4 rounded-2xl shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200"
            >
              <Download className="w-4 h-4" />
              <span>Install Now</span>
            </button>

            <button
              onClick={handleDismiss}
              className="px-3.5 py-2.5 rounded-2xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Not now
            </button>
          </div>

          {/* iOS Safari Instructions Modal / Banner */}
          {showIOSInstructions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-2"
            >
              <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Share className="w-3.5 h-3.5 text-blue-600" />
                To install on iOS:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-500 pl-1">
                <li>Tap the <strong className="text-slate-700">Share</strong> button in Safari</li>
                <li>Scroll down and tap <strong className="text-slate-700">Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline text-blue-600 ml-0.5" /></li>
              </ol>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
