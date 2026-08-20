import React from 'react';
import Link from 'next/link';
import { Upload, ArrowRight } from 'lucide-react';

export const SendCard: React.FC = () => {
  return (
    <div className="bg-[#FCFBFE] rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col items-center text-center group relative overflow-hidden box-border">
      {/* Card Icon Container */}
      <div className="w-16 h-16 bg-white text-blue-600 rounded-2xl flex items-center justify-center border border-slate-200/80 shadow-xs mb-4 group-hover:scale-105 transition-transform duration-300">
        <Upload className="w-8 h-8 stroke-[2]" />
      </div>

      {/* Card Title */}
      <h2 className="text-xl font-bold text-slate-900 mb-2">Send Files</h2>

      {/* Card Description */}
      <p className="text-xs sm:text-sm text-slate-500 mb-5 max-w-xs leading-relaxed">
        Upload one or multiple files and instantly generate a QR Code, Share Link and Share ID.
      </p>

      {/* CTA Button */}
      <Link
        href="/send"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition-all mt-auto cursor-pointer relative z-10"
      >
        Start Sending
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
};
