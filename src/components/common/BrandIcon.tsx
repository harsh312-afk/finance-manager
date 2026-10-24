import React from 'react';

interface BrandIconProps {
  className?: string;
  size?: number;
}

export const BrandIcon: React.FC<BrandIconProps> = ({ className = 'w-8 h-8', size }) => {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <defs>
        <linearGradient id="brandBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <linearGradient id="brandEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="brandCyan" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#brandBg)" stroke="#334155" strokeWidth="1.5" />
      <path
        d="M32 10 L48 16 V28 C48 39.5 41.2 49 32 53 C22.8 49 16 39.5 16 28 V16 Z"
        fill="#047857"
        fillOpacity="0.2"
        stroke="#10b981"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />
      <circle cx="32" cy="32" r="16" stroke="#475569" strokeWidth="2" strokeDasharray="3 3" />
      <path
        d="M22 23 L32 40 L42 23"
        stroke="url(#brandEmerald)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="27" r="4" fill="url(#brandCyan)" />
      <path d="M43 15 L45 19 L49 21 L45 23 L43 27 L41 23 L37 21 L41 19 Z" fill="#38bdf8" />
    </svg>
  );
};
