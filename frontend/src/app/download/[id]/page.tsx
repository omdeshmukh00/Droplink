"use client";

import React, { use, useState } from 'react';
import { Container } from '@/components/Container';
import { FileListItem } from '@/components/FileListItem';
import { Download, ShieldCheck, Clock, Archive } from 'lucide-react';
import Link from 'next/link';

export default function DownloadPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const shareId = resolvedParams.id;
  const [downloading, setDownloading] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Mock transfer data for demonstration
  const mockFiles = [
    { name: 'Project_Design_Specification_v2.pdf', size: 4520000, type: 'application/pdf' },
    { name: 'Assets_Icon_Set_2026.zip', size: 12800000, type: 'application/zip' },
  ];

  const handleDownloadAll = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      setCompleted(true);
    }, 1200);
  };

  return (
    <Container maxWidth="lg" className="py-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full mb-3">
          <ShieldCheck className="w-4 h-4" />
          Secure Encrypted Transfer
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
          Files Ready for Download
        </h1>
        <p className="text-slate-600 text-sm sm:text-base font-mono">
          Share ID: {shareId}
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md max-w-2xl mx-auto overflow-hidden box-border">
        {!completed ? (
          <>
            {/* Transfer Info Header */}
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/80 rounded-2xl mb-6 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-slate-600 font-medium">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Expires in 9 mins</span>
              </div>
              <div className="text-slate-500 font-medium">
                2 Files &bull; 17.3 MB
              </div>
            </div>

            {/* File Items */}
            <div className="space-y-3 mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Included Files
              </h3>
              {mockFiles.map((file, idx) => (
                <FileListItem
                  key={idx}
                  file={file}
                  onDownload={handleDownloadAll}
                  isDownloading={downloading}
                />
              ))}
            </div>

            {/* Download All CTA */}
            <button
              onClick={handleDownloadAll}
              disabled={downloading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Download className="w-5 h-5" />
              {downloading ? 'Preparing Download...' : 'Download All Files'}
            </button>
          </>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ✓
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">Download Complete!</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Your files have been safely downloaded to your device.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/send"
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl text-sm transition-all"
              >
                Send Files
              </Link>
              <Link
                href="/receive"
                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 px-6 rounded-xl text-sm transition-all"
              >
                Receive More
              </Link>
            </div>
          </div>
        )}
      </div>
    </Container>
  );
}
