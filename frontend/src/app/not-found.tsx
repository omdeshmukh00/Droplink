import React from 'react';
import Link from 'next/link';
import { Container } from '@/components/Container';
import { Home, Upload, Download, Lightbulb } from 'lucide-react';

export default function NotFound() {
  return (
    <Container maxWidth="7xl" className="px-0 py-4 sm:py-8 flex flex-col items-center justify-center min-h-[70vh]">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        {/* Illustration with mix-blend-multiply & disabled image drag */}
        <div className="flex justify-center items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/additionals/Root-error-boundry.png"
            alt="404 Transfer Not Found"
            width={480}
            height={300}
            className="w-full max-w-sm sm:max-w-md md:max-w-lg h-auto object-contain mx-auto mix-blend-multiply select-none pointer-events-none"
            draggable={false}
          />
        </div>

        {/* Title and Subtitle matching exact uploaded screenshot */}
        <div className="space-y-1 pt-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Transfer Not Found
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            This transfer doesn&apos;t exist or has already expired.
          </p>
        </div>

        {/* 3 Action Buttons matching exact uploaded screenshot */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 pb-4">
          {/* 1. Go Home */}
          <Link
            href="/"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-xs flex items-center gap-2 text-sm transition-all"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>

          {/* 2. Send Files -> /send */}
          <Link
            href="/send"
            className="bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-800 font-bold py-2.5 px-5 rounded-xl shadow-2xs flex items-center gap-2 text-sm transition-all"
          >
            <Upload className="w-4 h-4 text-blue-600" />
            Send Files
          </Link>

          {/* 3. Receive Files -> /receive */}
          <Link
            href="/receive"
            className="bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-800 font-bold py-2.5 px-5 rounded-xl shadow-2xs flex items-center gap-2 text-sm transition-all"
          >
            <Download className="w-4 h-4 text-blue-600" />
            Receive Files
          </Link>
        </div>

        {/* Bottom Tip Callout matching exact uploaded screenshot */}
        <div className="pt-2 flex flex-col items-center space-y-1">
          <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-0.5">
            <Lightbulb className="w-4 h-4" />
          </div>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            Tip: Check the link or ID and try again.<br />
            Transfers are available for a limited time only.
          </p>
        </div>
      </div>
    </Container>
  );
}