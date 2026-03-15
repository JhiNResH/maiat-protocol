'use client';

import React from 'react';
import { motion } from 'framer-motion';

const MeshBackground = () => (
  <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
    <div className="absolute inset-0 mesh-grid opacity-40" />
    <motion.div 
      animate={{ 
        scale: [1, 1.2, 1],
        x: [0, 100, 0],
        y: [0, -50, 0]
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-emerald-100/30 dark:bg-emerald-500/10 blur-[120px] rounded-full"
    />
    <motion.div 
      animate={{ 
        scale: [1.2, 1, 1.2],
        x: [0, -100, 0],
        y: [0, 50, 0]
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-blue-100/30 dark:bg-blue-500/10 blur-[120px] rounded-full"
    />
  </div>
);

export default MeshBackground;
