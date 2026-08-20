"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const Footer: React.FC = () => {
  const pathname = usePathname();

  return (
    <footer className="w-full border-t border-slate-200/80 bg-white py-3.5 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium text-slate-600">DropLink Network Active</span>
          <span>&bull;</span>
          <span>Instant &amp; Secure File Transfer</span>
        </div>

        {/* Footer Navigation Links matching user requirements */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className={`transition-colors ${
              pathname === '/'
                ? 'text-blue-600 font-semibold'
                : 'text-slate-600 hover:text-blue-600'
            }`}
          >
            Home
          </Link>
          <Link
            href="/about"
            className={`transition-colors ${
              pathname === '/about'
                ? 'text-blue-600 font-semibold'
                : 'text-slate-600 hover:text-blue-600'
            }`}
          >
            About
          </Link>
          <Link
            href="/privacy"
            className={`transition-colors ${
              pathname === '/privacy'
                ? 'text-blue-600 font-semibold'
                : 'text-slate-600 hover:text-blue-600'
            }`}
          >
            Privacy
          </Link>
          <a
            href="https://github.com/omdeshmukh00"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 hover:text-slate-900 transition-colors"
          >
            GitHub
          </a>
        </div>

        <p className="text-slate-400">&copy; {new Date().getFullYear()} DropLink. All rights reserved.</p>
      </div>
    </footer>
  );
};
