"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Container } from '@/components/Container';
import { Home, Upload, Download, RefreshCw, Lightbulb } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root Error Boundary caught an error:', error);
  }, [error]);

  return (
    <Container maxWidth="7xl" className="px-0 py-4 sm:py-8 flex flex-col items-center justify-center min-h-[70vh]">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        {/* Illustration with mix-blend-multiply & disabled image drag */}
        <div className="flex justify-center items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/additionals/Root-error-boundry.png"
            alt="Something Went Wrong"
            width={480}
            height={300}
            className="w-full max-w-sm sm:max-w-md md:max-w-lg h-auto object-contain mx-auto mix-blend-multiply select-none pointer-events-none"
            draggable={false}
          />
        </div>

        {/* Title and Subtitle */}
        <div className="space-y-1 pt-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Something Went Wrong
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            An unexpected error occurred or the transfer is currently unavailable.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 pb-4">
          {/* Try Again */}
          <button
            onClick={() => reset()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-xs flex items-center gap-2 text-sm transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>

          {/* Go Home */}
          <Link
            href="/"
            className="bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-800 font-bold py-2.5 px-5 rounded-xl shadow-2xs flex items-center gap-2 text-sm transition-all"
          >
            <Home className="w-4 h-4 text-blue-600" />
            Go Home
          </Link>

          {/* Send Files -> /send */}
          <Link
            href="/send"
            className="bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-800 font-bold py-2.5 px-5 rounded-xl shadow-2xs flex items-center gap-2 text-sm transition-all"
          >
            <Upload className="w-4 h-4 text-blue-600" />
            Send Files
          </Link>

          {/* Receive Files -> /receive */}
          <Link
            href="/receive"
            className="bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-800 font-bold py-2.5 px-5 rounded-xl shadow-2xs flex items-center gap-2 text-sm transition-all"
          >
            <Download className="w-4 h-4 text-blue-600" />
            Receive Files
          </Link>
        </div>

        {/* Bottom Tip Callout */}
        <div className="pt-2 flex flex-col items-center space-y-1">
          <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-0.5">
            <Lightbulb className="w-4 h-4" />
          </div>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            Tip: Refresh the page or check your network connection.<br />
            If the problem persists, try creating a new transfer.
          </p>
        </div>
      </div>
    </Container>
  );
}
