import React from 'react';
import Link from 'next/link';
import { Download, ArrowRight } from 'lucide-react';

export const ReceiveCard: React.FC = () => {
  return (
    <div className="bg-[#F6FFF9] rounded-3xl p-6 sm:p-7 border border-emerald-200/70 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col items-center text-center group relative overflow-hidden box-border">
      {/* Card Icon Container matching Img 2 */}
      <div className="w-16 h-16 bg-white text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-xs mb-4 group-hover:scale-105 transition-transform duration-300">
        <Download className="w-8 h-8 stroke-[2]" />
      </div>

      {/* Card Title */}
      <h2 className="text-xl font-bold text-slate-900 mb-2">Receive Files</h2>

      {/* Card Description matching Img 2 */}
      <p className="text-xs sm:text-sm text-slate-500 mb-5 max-w-xs leading-relaxed">
        Receive files using QR Code, Share Link or Share ID.
      </p>

      {/* CTA Button matching Img 2 */}
      <Link
        href="/receive"
        className="w-full bg-white hover:bg-emerald-50 text-emerald-600 border-2 border-emerald-600 py-3 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition-all mt-auto cursor-pointer relative z-10"
      >
        Receive Files
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
};
