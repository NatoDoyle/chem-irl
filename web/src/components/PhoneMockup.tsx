'use client';

import { motion } from 'framer-motion';

interface PhoneMockupProps {
  children?: React.ReactNode;
}

export function PhoneMockup({ children }: PhoneMockupProps) {
  return (
    <div className="relative" style={{ transform: 'rotate(5deg)' }}>
      <motion.div
        animate={{ y: [0, -4, 0, 4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="relative w-[260px] h-[540px] md:w-[280px] md:h-[580px] bg-ink-900 rounded-[44px] p-3 shadow-warm-lg border-4 border-ink-700">
          {/* Dynamic Island */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-ink-900 rounded-full z-10" />
          {/* Screen */}
          <div className="w-full h-full rounded-[36px] overflow-hidden">
            {children || (
              <div className="w-full h-full bg-gradient-to-br from-aqua-100 via-aqua-200 to-aqua-300" />
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
