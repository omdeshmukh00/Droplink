"use client";

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      // Detect standalone mode (already installed as PWA)
      const checkStandalone = () => {
        const isStandaloneMedia = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)').matches : false;
        const isIOSStandalone = (navigator as unknown as { standalone?: boolean })?.standalone === true;
        const installed = isStandaloneMedia || isIOSStandalone;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsStandalone(installed);
        setIsInstalled(installed);
      };

      checkStandalone();

      // Detect iOS devices
      const userAgent = window.navigator?.userAgent ? window.navigator.userAgent.toLowerCase() : '';
      const iosDevice = /iphone|ipad|ipod/.test(userAgent);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsIOS(iosDevice);

      // Listen for beforeinstallprompt event (Android / Chrome / Edge)
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setIsInstallable(true);
      };

      // Listen for appinstalled event
      const handleAppInstalled = () => {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    } catch (err) {
      console.warn('PWA initialization skipped:', err);
    }
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
    } catch (error) {
      console.error('PWA install prompt error:', error);
    }
    return false;
  };

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isStandalone,
    promptInstall,
  };
}
