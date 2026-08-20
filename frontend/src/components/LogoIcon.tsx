import React from 'react';

interface LogoIconProps {
  className?: string;
}

/**
 * Custom DropLink Brand Logo Icon (matching img 2 interlocking diagonal loops)
 */
export const LogoIcon: React.FC<LogoIconProps> = ({ className = "w-6 h-6" }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Lower-left loop */}
      <circle
        cx="9.5"
        cy="14.5"
        r="4.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Upper-right loop */}
      <circle
        cx="14.5"
        cy="9.5"
        r="4.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Interlocking overlay arc */}
      <path
        d="M12.6 7.6C13.2 7.2 13.9 7 14.6 7C17.1 7 19.1 9 19.1 11.5C19.1 12.2 18.8 12.9 18.4 13.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
};
