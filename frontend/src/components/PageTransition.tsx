"use client";

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsVisible(true);
  }, [pathname]);

  return (
    <div
      className={`w-full flex-grow flex flex-col items-center transition-all duration-300 ease-out transform ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-2 scale-[0.995]'
      }`}
    >
      {children}
    </div>
  );
};
