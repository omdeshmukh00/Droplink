"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Menu, X, Info, ShieldCheck, Home, Sun, Moon, Users, Download } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

const GithubIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
  </svg>
);

export const Navbar: React.FC = () => {
  const [mobileMenuMounted, setMobileMenuMounted] = useState(false);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const { isInstallable, isInstalled, isStandalone, promptInstall } = usePWA();
  const pathname = usePathname();

  const homeRef = useRef<HTMLAnchorElement>(null);
  const aboutRef = useRef<HTMLAnchorElement>(null);
  const privacyRef = useRef<HTMLAnchorElement>(null);
  const bulkRef = useRef<HTMLAnchorElement>(null);

  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const openMobileMenu = () => {
    setMobileMenuMounted(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMobileMenuVisible(true);
      });
    });
  };

  const closeMobileMenu = () => {
    setMobileMenuVisible(false);
    setTimeout(() => {
      setMobileMenuMounted(false);
    }, 300);
  };

  const toggleMobileMenu = () => {
    if (!mobileMenuVisible) {
      openMobileMenu();
    } else {
      closeMobileMenu();
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    closeMobileMenu();

    const updateIndicator = () => {
      let activeRef: HTMLAnchorElement | null = null;
      if (pathname === '/') activeRef = homeRef.current;
      if (pathname === '/about') activeRef = aboutRef.current;
      if (pathname === '/privacy') activeRef = privacyRef.current;
      if (pathname?.startsWith('/bulk')) activeRef = bulkRef.current;

      if (activeRef) {
        setIndicatorStyle({
          left: activeRef.offsetLeft,
          width: activeRef.offsetWidth,
          opacity: 1,
        });
      } else {
        setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      }
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 w-full pt-2 sm:pt-3 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Floating Card Navbar with Reduced Border Radius */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/70 shadow-lg shadow-slate-200/60 px-4 sm:px-6 h-14 sm:h-15 flex items-center justify-between transition-all relative z-50">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group transition-all"
        >
          <Image
            src="/DropLink-logo.png"
            alt="DropLink Logo"
            width={38}
            height={38}
            className="w-9 h-9 object-contain rounded-xl group-hover:scale-105 transition-transform select-none pointer-events-none"
            priority
            draggable={false}
          />
          <span className="text-slate-900 font-extrabold tracking-tight text-xl sm:text-2xl">
            Drop<span className="text-blue-600">Link</span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 relative">
          <Link
            ref={homeRef}
            href="/"
            className={`py-1 text-sm font-medium transition-colors ${
              pathname === '/'
                ? 'text-blue-600 font-semibold'
                : 'text-slate-600 hover:text-blue-600'
            }`}
          >
            Home
          </Link>
          <Link
            ref={bulkRef}
            href="/bulk"
            className={`py-1 text-sm font-medium transition-colors ${
              pathname?.startsWith('/bulk')
                ? 'text-purple-600 font-semibold'
                : 'text-slate-600 hover:text-purple-600'
            }`}
          >
            Bulk Transfer
          </Link>
          <Link
            ref={aboutRef}
            href="/about"
            className={`py-1 text-sm font-medium transition-colors ${
              pathname === '/about'
                ? 'text-blue-600 font-semibold'
                : 'text-slate-600 hover:text-blue-600'
            }`}
          >
            About
          </Link>
          <Link
            ref={privacyRef}
            href="/privacy"
            className={`py-1 text-sm font-medium transition-colors ${
              pathname === '/privacy'
                ? 'text-blue-600 font-semibold'
                : 'text-slate-600 hover:text-blue-600'
            }`}
          >
            Privacy
          </Link>

          {/* Smooth Sliding Active Underline Indicator Bar */}
          <span
            className="absolute -bottom-3.5 h-[2.5px] bg-blue-600 rounded-full transition-all duration-300 ease-in-out pointer-events-none"
            style={{
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
              opacity: indicatorStyle.opacity,
            }}
          />

          {/* PWA Install Button (If Installable) */}
          {!isStandalone && !isInstalled && isInstallable && (
            <button
              onClick={() => promptInstall()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold text-xs transition-all shadow-xs"
              title="Install DropLink App"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}

          <a
            href="https://github.com/omdeshmukh00"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <GithubIcon className="w-5 h-5 text-slate-700 hover:text-slate-900" />
            GitHub
          </a>

          {/* Desktop Theme Toggle Pill Switch */}
          <div
            className="flex items-center bg-slate-100 p-0.5 rounded-full border border-slate-200/80 shadow-inner cursor-pointer"
            title="Theme Toggle"
          >
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-xs text-slate-800">
              <Sun className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <div className="w-6 h-6 flex items-center justify-center text-slate-400">
              <Moon className="w-3.5 h-3.5 stroke-[2]" />
            </div>
          </div>
        </nav>


        {/* Mobile Right Controls: Theme Switch + Hamburger Button */}
        <div className="flex items-center gap-2 sm:gap-3 md:hidden">
          {/* Mobile Theme Toggle Pill Switch */}
          <div
            className="flex items-center bg-slate-100 p-0.5 rounded-full border border-slate-200/80 shadow-inner cursor-pointer"
            title="Theme Toggle"
          >
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-white rounded-full flex items-center justify-center shadow-xs text-slate-800">
              <Sun className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
            </div>
            <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-slate-400">
              <Moon className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2]" />
            </div>
          </div>

          {/* Hamburger Menu Toggle */}
          <button
            type="button"
            onClick={toggleMobileMenu}
            className="p-1.5 sm:p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors relative z-50 cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuVisible ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        </div>
      </div>

      {/* Floating Mobile Overlay & Floating Card Menu with Smooth Spring Transitions */}
      {mobileMenuMounted && (
        <>
          {/* Backdrop Blur Overlay */}
          <div
            className={`fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs transition-opacity duration-300 ease-out md:hidden ${
              mobileMenuVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onClick={closeMobileMenu}
          />

          {/* Floating Card Drawer */}
          <div
            className={`absolute top-full left-4 right-4 z-50 mt-2 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-md px-4 pt-3 pb-5 space-y-2 shadow-xl shadow-slate-900/10 transition-all duration-300 ease-out md:hidden ${
              mobileMenuVisible
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'
            }`}
          >
            <Link
              href="/"
              onClick={closeMobileMenu}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === '/'
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Home className="w-4 h-4 text-blue-600" />
              Home
            </Link>
            <Link
              href="/bulk"
              onClick={closeMobileMenu}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname?.startsWith('/bulk')
                  ? 'bg-purple-50 text-purple-600 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4 text-purple-600" />
              Bulk Transfer
            </Link>
            <Link
              href="/about"
              onClick={closeMobileMenu}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === '/about'
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Info className="w-4 h-4 text-slate-500" />
              About
            </Link>
            <Link
              href="/privacy"
              onClick={closeMobileMenu}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === '/privacy'
                  ? 'bg-blue-50 text-blue-600 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              Privacy Policy
            </Link>

            {!isStandalone && !isInstalled && isInstallable && (
              <button
                onClick={() => {
                  promptInstall();
                  closeMobileMenu();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <Download className="w-4 h-4 text-blue-600" />
                Install App (PWA)
              </button>
            )}

            <a
              href="https://github.com/omdeshmukh00"
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMobileMenu}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <GithubIcon className="w-4 h-4 text-slate-600" />
              GitHub
            </a>

          </div>
        </>
      )}
    </header>
  );
};
