'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface AlertResult { id: string; triggered: boolean; metric: string; value: number; threshold: number; }

export default function AlertBanner() {
  const [alerts, setAlerts] = useState<AlertResult[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const check = async () => {
      try { const r = await fetch('/api/alerts/check'); if (r.ok) { const d = await r.json(); setAlerts((d.results || []).filter((r: AlertResult) => r.triggered)); } } catch {}
    };
    check();
    const i = setInterval(check, 120000);
    return () => clearInterval(i);
  }, []);

  const active = alerts.filter(a => !dismissed.has(a.id));
  if (active.length === 0) return null;

  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-3">
      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
      <div className="flex-1 flex items-center gap-3 overflow-x-auto text-xs">
        {active.map(a => (
          <span key={a.id} className="flex items-center gap-1.5 text-red-700 whitespace-nowrap">
            <span className="font-medium">{a.metric}</span>
            <span className="text-red-500">{a.value} (limit: {a.threshold})</span>
            <button onClick={() => setDismissed(p => new Set([...p, a.id]))} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
    </div>
  );
}
