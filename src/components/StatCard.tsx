'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
  description?: string;
  delay?: number;
}

export default function StatCard({ label, value, change, changeType, description, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ 
        delay, 
        duration: 0.8, 
        ease: [0.16, 1, 0.3, 1] 
      }}
      whileHover={{ scale: 1.02 }}
      className="liquid-glass p-8 rounded-[2.5rem] hover-lift transition-all group"
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">{label}</p>
      <motion.h3 
        whileHover={{ x: 5 }}
        className="text-4xl font-bold text-[var(--text-color)] mb-3 tracking-tight transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
      >
        {value}
      </motion.h3>
      
      {change && (
        <div className="flex items-center gap-2">
          {changeType === 'increase' && <TrendingUp size={16} className="text-emerald-500 dark:text-emerald-400" />}
          {changeType === 'decrease' && <TrendingDown size={16} className="text-rose-500 dark:text-rose-400" />}
          {changeType === 'neutral' && <Minus size={16} className="text-[var(--text-muted)]" />}
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-widest",
            changeType === 'increase' ? "text-emerald-500 dark:text-emerald-400" : 
            changeType === 'decrease' ? "text-rose-500 dark:text-rose-400" : "text-[var(--text-muted)]"
          )}>
            {change}
          </span>
          {description && <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold">{description}</span>}
        </div>
      )}
    </motion.div>
  );
}
