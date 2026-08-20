import React from 'react';
import { Container } from '@/components/Container';
import {
  ShieldCheck,
  HardDrive,
  Trash2,
  UserX,
  EyeOff,
  Lock,
  Upload,
  Download,
} from 'lucide-react';

export default function PrivacyPage() {
  const pillars = [
    {
      icon: <HardDrive className="w-5 h-5 text-blue-600" />,
      bg: 'bg-blue-100/70',
      title: 'Temporary Storage',
      desc: 'Files are temporarily stored on our secure servers only to enable fast transfers.',
    },
    {
      icon: <Trash2 className="w-5 h-5 text-emerald-600" />,
      bg: 'bg-emerald-100/70',
      title: 'Auto Deletion',
      desc: 'Files are automatically deleted after the download is complete or when they expire.',
    },
    {
      icon: <UserX className="w-5 h-5 text-purple-600" />,
      bg: 'bg-purple-100/70',
      title: 'No Accounts',
      desc: 'DropLink does not require sign-ups or logins. You stay anonymous always.',
    },
    {
      icon: <EyeOff className="w-5 h-5 text-amber-600" />,
      bg: 'bg-amber-100/70',
      title: 'No Data Collection',
      desc: 'We do not collect, store, or share any personal information about you.',
    },
    {
      icon: <Lock className="w-5 h-5 text-teal-600" />,
      bg: 'bg-teal-100/70',
      title: 'Secure by Design',
      desc: 'All transfers are protected with industry-standard security practices.',
    },
  ];

  return (
    <Container maxWidth="7xl" className="px-0 py-3 sm:py-6 space-y-5 sm:space-y-6">
      {/* 1. Top Header */}
      <div className="text-center space-y-2 pt-2 pb-1 max-w-2xl mx-auto">
        <div className="w-12 h-12 rounded-full bg-blue-100/80 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-xs border border-blue-200/60">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Your Privacy Matters
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
          DropLink is built with a privacy-first philosophy.<br />
          We collect nothing. We store only what&apos;s necessary, and for the shortest time possible.
        </p>
      </div>

      {/* 2. Section 1: 5 Pillar Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {pillars.map((item, idx) => (
          <div
            key={idx}
            className="bg-[#FCFBFE] rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-blue-300 transition-all flex flex-col items-center text-center group"
          >
            <div className={`w-11 h-11 ${item.bg} rounded-full flex items-center justify-center mb-3.5 group-hover:scale-110 transition-transform`}>
              {item.icon}
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1.5">{item.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* 3. Section 2: "How We Handle Your Files" Card with #FCFBFE Background */}
      <div className="bg-[#FCFBFE] rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative">
        {/* Center Header with Horizontal Divider Line */}
        <div className="relative flex items-center justify-center mb-8 sm:mb-10">
          <div className="w-full border-t border-slate-200/80" />
          <span className="bg-[#FCFBFE] px-4 text-sm font-bold text-slate-900 absolute">
            How We Handle Your Files
          </span>
        </div>

        {/* 4-Step Pipeline Flow */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4 relative">
          {/* Step 1 */}
          <div className="flex flex-col items-center text-center space-y-2 relative group">
            <div className="w-12 h-12 rounded-full bg-blue-100/80 text-blue-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">1. Upload</h4>
            <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
              You upload your file(s) through your browser.
            </p>
            <div className="hidden md:block absolute top-6 -right-6 w-12 text-slate-300">
              <svg viewBox="0 0 40 12" fill="none" className="w-full h-auto">
                <path d="M0 6H32M32 6L26 1M32 6L26 11" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center space-y-2 relative group">
            <div className="w-12 h-12 rounded-full bg-emerald-100/80 text-emerald-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <Lock className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">2. Secure & Store</h4>
            <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
              We securely store your file temporarily for the transfer.
            </p>
            <div className="hidden md:block absolute top-6 -right-6 w-12 text-slate-300">
              <svg viewBox="0 0 40 12" fill="none" className="w-full h-auto">
                <path d="M0 6H32M32 6L26 1M32 6L26 11" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center space-y-2 relative group">
            <div className="w-12 h-12 rounded-full bg-purple-100/80 text-purple-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <Download className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">3. Download</h4>
            <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
              The recipient downloads the file from our server.
            </p>
            <div className="hidden md:block absolute top-6 -right-6 w-12 text-slate-300">
              <svg viewBox="0 0 40 12" fill="none" className="w-full h-auto">
                <path d="M0 6H32M32 6L26 1M32 6L26 11" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex flex-col items-center text-center space-y-2 group">
            <div className="w-12 h-12 rounded-full bg-amber-100/80 text-amber-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <Trash2 className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">4. Auto Delete</h4>
            <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
              The file is permanently deleted after download or expiration.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Section 3: Bottom Dual Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-blue-50/70 border border-blue-100 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-2xs">
          <div className="w-10 h-10 bg-white text-blue-600 rounded-xl flex items-center justify-center shrink-0 border border-blue-100 shadow-xs">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs sm:text-sm font-bold text-blue-600">Our Commitment</h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              We believe privacy is a fundamental right. Our goal is to make file sharing simple, fast, and private — today and in the future.
            </p>
          </div>
        </div>

        <div className="lg:col-span-5 bg-blue-50/70 border border-blue-100 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-600">Coming Soon</span>
            <span className="bg-blue-100 text-blue-700 text-2xs font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Future
            </span>
          </div>
          <h4 className="text-sm font-bold text-slate-900">End-to-End Encryption</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            We are working on end-to-end encryption so that only you and your recipient can access your files.
          </p>
        </div>
      </div>

      {/* 5. Footer Caption */}
      <div className="text-center pt-2">
        <p className="text-xs text-slate-400 font-medium inline-flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          Simple. Secure. Private. That&apos;s DropLink.
        </p>
      </div>
    </Container>
  );
}
