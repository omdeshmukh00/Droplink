"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

export const Hero: React.FC = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <div suppressHydrationWarning className="text-center mb-3 sm:mb-4 flex flex-col items-center max-w-full overflow-hidden">
      {/* Hero Logo Squircle matching Img 2 */}
      <div suppressHydrationWarning className="w-14 h-14 sm:w-16 sm:h-16 relative mb-2.5 transition-transform hover:scale-105 duration-300">
        {mounted && (
          <Image
            src="/DropLink-logo.png"
            alt="DropLink Brand Logo"
            width={64}
            height={64}
            className="w-full h-full object-contain rounded-2xl select-none pointer-events-none"
            priority
            draggable={false}
          />
        )}
      </div>

      {/* Main Title - DropLink with blue Link matching Navbar */}
      <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-1">
        Drop<span className="text-blue-600">Link</span>
      </h1>

      {/* Subtitle - Lighter blue contrast */}
      <p className="text-xl sm:text-2xl font-bold text-blue-500/90 mb-1.5">
        Instant Secure File Sharing
      </p>

      {/* Description */}
      <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-lg mb-2.5 leading-relaxed">
        Transfer files between any devices using only your browser.
      </p>

      {/* Feature Badges */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm font-medium text-slate-500">
        <span>No Login</span>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
        <span>No Installation</span>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
        <span>No Cable</span>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
        <span>No App</span>
      </div>
    </div>
  );
};
