"use client";

import React from 'react';
import Link from 'next/link';
import { Users, ArrowRight } from 'lucide-react';

export const BulkCard: React.FC = () => {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-md hover:shadow-lg transition-all flex flex-col justify-between group">
      <div>
        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <Users className="w-6 h-6 stroke-[2]" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-900 mb-1.5">
          Bulk Transfer
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6">
          Ideal for classrooms, presentations &amp; shared PCs. Users share files directly to one host without pendrives.
        </p>
      </div>

      <Link
        href="/bulk"
        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 px-5 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 text-sm group-hover:gap-3 cursor-pointer relative z-10"
      >
        <span>Start Bulk Session</span>
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
};
