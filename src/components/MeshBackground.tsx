'use client';

import React from 'react';
import { useTheme } from '@/components/ThemeProvider';

const MeshBackground = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      <div
        className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-1000 ${
          isDark ? 'bg-blue-900/20' : 'bg-blue-100/30'
        }`}
      />
      <div
        className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] transition-colors duration-1000 ${
          isDark ? 'bg-purple-900/10' : 'bg-orange-50/40'
        }`}
      />
    </div>
  );
};

export default MeshBackground;
