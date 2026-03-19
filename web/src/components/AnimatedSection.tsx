'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedSectionProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'left' | 'right';
  className?: string;
}

export function AnimatedSection({
  children,
  delay = 0,
  direction = 'up',
  className,
}: AnimatedSectionProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  const initial = {
    opacity: 0,
    x: direction === 'left' ? -30 : direction === 'right' ? 30 : 0,
    y: direction === 'up' ? 30 : 0,
  };

  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : initial}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
