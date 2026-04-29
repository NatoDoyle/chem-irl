'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const SCREEN_DURATION_MS = 3500;

export function PhoneScreens() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % 3);
    }, SCREEN_DURATION_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative w-full h-full bg-warm-bg">
      <AnimatePresence mode="wait">
        {index === 0 && (
          <ScreenFrame key="discover">
            <DiscoverScreen />
          </ScreenFrame>
        )}
        {index === 1 && (
          <ScreenFrame key="propose">
            <ProposeScreen />
          </ScreenFrame>
        )}
        {index === 2 && (
          <ScreenFrame key="confirmed">
            <ConfirmedScreen />
          </ScreenFrame>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScreenFrame({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="absolute inset-0"
    >
      {children}
    </motion.div>
  );
}

// --- Screens --------------------------------------------------------------

function DiscoverScreen() {
  return (
    <div className="flex h-full flex-col px-4 pt-9 pb-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-ink-900">Discover</h3>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-aqua-50 text-[10px] text-aqua-700">
          ⚙
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden rounded-[18px] bg-gradient-to-br from-coral via-gold-400 to-aqua-400">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="select-none text-[110px] font-bold leading-none text-white/25">
            A
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/30 to-transparent p-3">
          <p className="text-[15px] font-bold text-white">Anna, 24</p>
          <p className="text-[11px] text-white/85">
            Coffee on Capel St · Wicklow Way hikes
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-4">
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-aqua-200 bg-white text-lg text-ink-700 shadow-subtle"
        >
          ✕
        </button>
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-aqua-600 text-lg text-white shadow-warm"
        >
          ♡
        </button>
      </div>
    </div>
  );
}

function ProposeScreen() {
  return (
    <div className="flex h-full flex-col px-4 pt-9 pb-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[11px] font-medium text-aqua-700">←</span>
        <h3 className="text-[15px] font-bold text-ink-900">Suggest 2–3 times</h3>
      </div>
      <p className="mb-3 text-[11px] text-ink-500">
        Pick times within the next 7 days
      </p>
      <div className="space-y-2">
        <TimeRow day="Thu" time="7:00 PM" hint="Tomorrow" checked />
        <TimeRow day="Sat" time="6:30 PM" hint="In 3 days" checked />
        <TimeRow day="Sun" time="11:00 AM" hint="Brunch" />
      </div>
      <div className="mt-auto">
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          className="w-full rounded-xl bg-aqua-600 py-3 text-[13px] font-semibold text-white shadow-warm"
        >
          Propose times
        </button>
        <p className="mt-2 text-center text-[10px] text-ink-500">
          Expires in 72 hours
        </p>
      </div>
    </div>
  );
}

function TimeRow({
  day,
  time,
  hint,
  checked = false,
}: {
  day: string;
  time: string;
  hint: string;
  checked?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        checked
          ? 'border-aqua-300 bg-aqua-50'
          : 'border-aqua-100 bg-white'
      }`}
    >
      <div
        className={`flex h-5 w-5 flex-none items-center justify-center rounded-md border ${
          checked
            ? 'border-aqua-600 bg-aqua-600 text-white'
            : 'border-aqua-200 bg-white'
        }`}
      >
        {checked && <span className="text-[11px] leading-none">✓</span>}
      </div>
      <div className="flex flex-1 items-baseline gap-1.5">
        <span className="text-[12px] font-semibold text-ink-900">{day}</span>
        <span className="text-[12px] text-ink-700">{time}</span>
      </div>
      <span className="text-[10px] text-ink-500">{hint}</span>
    </div>
  );
}

function ConfirmedScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 pt-9 pb-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-aqua-100">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-aqua-600 text-2xl text-white">
          ✓
        </div>
      </div>
      <h3 className="text-[18px] font-bold text-ink-900">Date confirmed</h3>
      <p className="mt-1 text-[13px] font-semibold text-aqua-700">
        Sat 8:00 PM · Mary&rsquo;s
      </p>
      <p className="text-[11px] text-ink-500">Wexford St, Dublin 2</p>
      <div className="mt-5 w-full rounded-xl border border-aqua-200 bg-white px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-wide text-aqua-700">
          Chat unlocked
        </p>
        <p className="mt-1 text-[12px] text-ink-700">
          See you Saturday — I&rsquo;ll grab a table by the window.
        </p>
      </div>
    </div>
  );
}
