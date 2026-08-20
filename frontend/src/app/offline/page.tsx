"use client";

import { Container } from '@/components/Container';
import { WifiOff, RotateCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <Container maxWidth="lg" className="py-12 text-center">
      <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-md max-w-lg mx-auto box-border">
        <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-10 h-10 stroke-[1.75]" />
        </div>

        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">You are Offline</h1>
        <p className="text-sm text-slate-600 mb-8 leading-relaxed">
          Please check your internet connection to continue sharing or receiving files on DropLink.
        </p>

        <button
          onClick={() => typeof window !== 'undefined' && window.location.reload()}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-all text-sm"
        >
          <RotateCw className="w-4 h-4" />
          Retry Connection
        </button>
      </div>
    </Container>
  );
}
