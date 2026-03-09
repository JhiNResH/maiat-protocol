'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import MonitorContent to avoid Privy hooks during SSR
const MonitorContent = dynamic(
  () => import('./MonitorContent').then(mod => mod.MonitorContent),
  { ssr: false }
);

export default function MonitorPage() { 
  return (
    <Suspense fallback={<div className="h-screen bg-[var(--bg-page)] flex items-center justify-center text-[var(--primary-gold)] font-mono tracking-tighter uppercase">Initializing Tactical Interface...</div>}>
      <MonitorContent />
    </Suspense>
  ); 
}
