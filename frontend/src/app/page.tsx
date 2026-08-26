import React from 'react';
import { Container } from '@/components/Container';
import { Hero } from '@/components/Hero';
import { SendCard } from '@/components/SendCard';
import { ReceiveCard } from '@/components/ReceiveCard';
import { BulkCard } from '@/components/BulkCard';
import { Shield, QrCode, CreditCard, Trash2 } from 'lucide-react';

export default function Home() {
  return (
    <Container maxWidth="7xl" className="py-1 flex flex-col items-center justify-center">
      {/* Hero Header */}
      <Hero />

      {/* 3 Primary Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 w-full max-w-5xl mx-auto">
        <SendCard />
        <ReceiveCard />
        <BulkCard />
      </div>

      {/* Bottom Feature Badges matching Img 2 */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 mt-3.5 sm:mt-4">
        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-2xl border border-slate-200/80 shadow-2xs text-xs sm:text-sm font-semibold text-slate-700">
          <Shield className="w-4 h-4 text-blue-600" />
          <span>Secure Transfer</span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-2xl border border-slate-200/80 shadow-2xs text-xs sm:text-sm font-semibold text-slate-700">
          <QrCode className="w-4 h-4 text-blue-600" />
          <span>QR Code</span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-2xl border border-slate-200/80 shadow-2xs text-xs sm:text-sm font-semibold text-slate-700">
          <CreditCard className="w-4 h-4 text-blue-600" />
          <span>Share ID</span>
        </div>
        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-2xl border border-slate-200/80 shadow-2xs text-xs sm:text-sm font-semibold text-slate-700">
          <Trash2 className="w-4 h-4 text-emerald-600" />
          <span>Auto Delete</span>
        </div>
      </div>
    </Container>
  );
}
