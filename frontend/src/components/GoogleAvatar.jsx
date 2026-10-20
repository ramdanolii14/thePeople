// File: frontend/src/components/GoogleAvatar.jsx
import React, { useState, useEffect } from 'react';

export default function GoogleAvatar({ name, src, size = 'md', className = '' }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const googleColors = [
    'bg-[#1A73E8]',
    'bg-[#D93025]',
    'bg-[#188038]',
    'bg-[#F29900]',
    'bg-[#9334E6]',
    'bg-[#007B83]',
    'bg-[#E52592]',
    'bg-[#5F6368]'
  ];

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-3xl'
  };

  const getColorClass = (str) => {
    if (!str) return googleColors[7];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return googleColors[Math.abs(hash) % googleColors.length];
  };

  const getInitials = (str) => {
    if (!str || !str.trim()) return '';
    const parts = str.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (src && src.trim() !== '' && !imgError) {
    return (
      <img
        src={src}
        alt={name || 'User Avatar'}
        onError={() => setImgError(true)}
        className={`${sizeClasses[size]} rounded-full object-cover border border-gray-200 shrink-0 ${className}`}
      />
    );
  }

  const initials = getInitials(name);

  if (initials) {
    return (
      <div
        title={name}
        className={`${sizeClasses[size]} ${getColorClass(name)} rounded-full flex items-center justify-center text-white font-semibold select-none shrink-0 ${className}`}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} bg-gray-200 text-gray-500 rounded-full flex items-center justify-center overflow-hidden shrink-0 ${className}`}
    >
      <svg className="w-3/4 h-3/4 mt-2" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
}