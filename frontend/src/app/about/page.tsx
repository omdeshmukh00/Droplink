import React from 'react';
import Image from 'next/image';
import { Container } from '@/components/Container';
import {
  Scissors,
  Globe,
  Shield,
  Clock,
  Zap,
  Lock,
  ShieldCheck,
} from 'lucide-react';

// Roadmap Top-Right Mountain Illustration SVG matching Img 3
const MountainIllustration = () => (
  <svg viewBox="0 0 160 90" className="w-24 h-16 sm:w-28 sm:h-18" fill="none">
    {/* Clouds */}
    <ellipse cx="30" cy="40" rx="18" ry="10" fill="#F1F5F9" />
    <ellipse cx="130" cy="45" rx="20" ry="10" fill="#F1F5F9" />

    {/* Small Side Peaks */}
    <polygon points="20,80 50,45 80,80" fill="#64748B" />
    <polygon points="80,80 115,50 145,80" fill="#475569" />

    {/* Main Center Peak */}
    <polygon points="40,80 85,25 130,80" fill="#334155" />
    <polygon points="85,25 85,80 130,80" fill="#1E293B" opacity="0.2" />

    {/* Flagpole & Blue Flag on Peak matching Img 3 */}
    <line x1="85" y1="25" x2="85" y2="8" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M 85 8 L 110 13 L 85 19 Z" fill="#2563EB" />
  </svg>
);

export default function AboutPage() {
  const whyFeatures = [
    {
      icon: <Scissors className="w-5 h-5 text-emerald-600" />,
      bg: 'bg-emerald-100/70',
      title: 'No Login',
      desc: 'Use DropLink instantly without creating an account or sharing any personal information.',
    },
    {
      icon: <Globe className="w-5 h-5 text-blue-600" />,
      bg: 'bg-blue-100/70',
      title: 'Browser Only',
      desc: '100% web-based. Works on any device with a modern browser.',
    },
    {
      icon: <Shield className="w-5 h-5 text-purple-600" />,
      bg: 'bg-purple-100/70',
      title: 'Privacy First',
      desc: "Your files are private and secure. We don't store any personal data.",
    },
    {
      icon: <Clock className="w-5 h-5 text-amber-600" />,
      bg: 'bg-amber-100/70',
      title: 'Auto Deletion',
      desc: 'Files are automatically deleted after the download or expiry time.',
    },
    {
      icon: <Zap className="w-5 h-5 text-teal-600" />,
      bg: 'bg-teal-100/70',
      title: 'No Limits',
      desc: 'Share any type of file quickly. No sign-up, no restrictions.',
    },
    {
      icon: <Lock className="w-5 h-5 text-rose-600" />,
      bg: 'bg-rose-100/70',
      title: 'Secure Transfer',
      desc: 'All transfers are secured with advanced encryption and best practices.',
    },
  ];

  return (
    <Container maxWidth="7xl" className="px-0 py-3 sm:py-6 space-y-4 sm:space-y-6">
      {/* 1. Hero Section Card with #FCFBFE Container Background */}
      <div className="bg-[#FCFBFE] rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-200/80 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 space-y-2.5 sm:space-y-3 text-center sm:text-left">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            About Drop<span className="text-blue-600">Link</span>
          </h1>
          <p className="text-blue-600 font-bold text-base sm:text-xl">
            Instant. Secure. Private.
          </p>
          <p className="text-slate-600 text-xs sm:text-base leading-relaxed max-w-xl mx-auto sm:mx-0">
            DropLink is a modern, browser-based file transfer application that lets you share files instantly between any devices. No sign-ups, no installations, no limits on simplicity.
          </p>
        </div>
        <div className="lg:col-span-5 flex justify-center">
          <Image
            src="/about-page-peer.png"
            alt="About DropLink Peer Transfer"
            width={380}
            height={180}
            className="w-full max-w-[260px] sm:max-w-md h-auto object-contain select-none pointer-events-none"
            priority
            draggable={false}
          />
        </div>
      </div>

      {/* 2. Why DropLink? Section Card with #FCFBFE Container Background */}
      <div className="bg-[#FCFBFE] rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-200/80 shadow-xs space-y-5 sm:space-y-6">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900 mb-1">
            Why DropLink?
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            We built DropLink to make file sharing effortless, fast, and respectful of your privacy.
          </p>
        </div>

        {/* 6 Feature Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {whyFeatures.map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-blue-300 transition-all flex flex-col items-center text-center group"
            >
              <div className={`w-10 h-10 ${item.bg} rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                {item.icon}
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1.5">{item.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Roadmap Section Card with #FCFBFE Container Background */}
      <div className="bg-[#FCFBFE] rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-slate-200/80 shadow-xs relative overflow-hidden">
        {/* Top Section Header with Mountain Illustration */}
        <div className="flex items-start justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-slate-900 mb-1">
              Roadmap
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Building the future of private file sharing.
            </p>
          </div>
          <div className="hidden sm:block">
            <MountainIllustration />
          </div>
        </div>

        {/* Timeline Progress Line */}
        <div className="relative pt-2 sm:pt-4 pb-2">
          {/* Horizontal Connecting Bar */}
          <div className="hidden md:block absolute top-8 left-1/6 right-1/6 h-0.5 bg-slate-200 z-0" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 relative z-10">
            {/* Phase 1 */}
            <div className="bg-slate-50/70 sm:bg-transparent rounded-2xl p-4 sm:p-0 border border-slate-200/60 sm:border-0 flex flex-col items-center text-center space-y-2">
              <div className="w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-xs z-10" />
              <span className="bg-blue-100 text-blue-700 text-2xs font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Phase 1
              </span>
              <h4 className="text-sm font-bold text-slate-900">WebRTC Transfer</h4>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Direct peer-to-peer transfers for lightning-fast speed.
              </p>
              <span className="text-xs font-bold text-blue-600 pt-1">Q2 2025</span>
            </div>

            {/* Phase 2 */}
            <div className="bg-slate-50/70 sm:bg-transparent rounded-2xl p-4 sm:p-0 border border-slate-200/60 sm:border-0 flex flex-col items-center text-center space-y-2">
              <div className="w-4 h-4 rounded-full bg-purple-600 border-4 border-white shadow-xs z-10" />
              <span className="bg-purple-100 text-purple-700 text-2xs font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Phase 2
              </span>
              <h4 className="text-sm font-bold text-slate-900">End-to-End Encryption</h4>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Client-side encryption so only you and your recipient can access the files.
              </p>
              <span className="text-xs font-bold text-purple-600 pt-1">Q3 2025</span>
            </div>

            {/* Phase 3 */}
            <div className="bg-slate-50/70 sm:bg-transparent rounded-2xl p-4 sm:p-0 border border-slate-200/60 sm:border-0 flex flex-col items-center text-center space-y-2">
              <div className="w-4 h-4 rounded-full bg-emerald-600 border-4 border-white shadow-xs z-10" />
              <span className="bg-emerald-100 text-emerald-700 text-2xs font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Phase 3
              </span>
              <h4 className="text-sm font-bold text-slate-900">Cloud Storage (Optional)</h4>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Save and manage your files securely in the cloud with complete control.
              </p>
              <span className="text-xs font-bold text-emerald-600 pt-1">Q4 2025</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Our Promise Banner Card */}
      <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4 shadow-2xs">
        <div className="w-10 h-10 bg-white text-blue-600 rounded-xl flex items-center justify-center shrink-0 border border-blue-100 shadow-xs">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-xs sm:text-sm font-bold text-blue-600">Our Promise</h4>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            We believe file sharing should be simple, fast, and private. DropLink will always put your data and privacy first.
          </p>
        </div>
      </div>
    </Container>
  );
}
