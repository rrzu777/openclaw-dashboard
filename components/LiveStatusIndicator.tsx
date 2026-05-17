'use client';

import { useState, useEffect } from 'react';
import { GATEWAY_POLL_INTERVAL } from '@/lib/constants';
import { clsx } from 'clsx';

type SystemStatus = 'online' | 'degraded' | 'offline' | 'loading';

export default function LiveStatusIndicator() {
  const [status, setStatus] = useState<SystemStatus>('loading');

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/system-health', { signal: AbortSignal.timeout(5000) });
        if (!res.ok) { setStatus('offline'); return; }
        const data = await res.json();

        const gatewayUp = data.gateway?.responsive || data.gateway?.running;
        const dashboardUp = data.dashboard?.running;

        if (gatewayUp && dashboardUp) setStatus('online');
        else if (gatewayUp || dashboardUp) setStatus('degraded');
        else setStatus('offline');
      } catch {
        setStatus('offline');
      }
    };

    check();
    const interval = setInterval(check, GATEWAY_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const config = {
    online: { color: 'bg-green-500', shadow: 'shadow-[0_0_8px_rgba(34,197,94,0.6)]', label: 'System Online', pulse: true },
    degraded: { color: 'bg-amber-500', shadow: 'shadow-[0_0_8px_rgba(245,158,11,0.6)]', label: 'Degraded', pulse: true },
    offline: { color: 'bg-red-500', shadow: 'shadow-[0_0_8px_rgba(239,68,68,0.6)]', label: 'System Offline', pulse: false },
    loading: { color: 'bg-gray-400', shadow: '', label: 'Checking...', pulse: true },
  }[status];

  return (
    <div className="flex gap-2 text-sm text-gray-500 items-center bg-white border px-3 py-1.5 rounded-full shadow-sm">
      <span className={clsx("w-2 h-2 rounded-full", config.color, config.shadow, config.pulse && "animate-pulse")} />
      <span className="font-medium">{config.label}</span>
    </div>
  );
}
