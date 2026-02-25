"use client";

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Clock, CheckCircle, Cpu } from 'lucide-react';
import { useEvents } from '@/contexts/EventsContext';

interface MCEvent {
  id: string;
  ts: string;
  type: string;
  level: string;
  message: string;
}

interface Summary {
  total: number;
  tasks: number;
  errors: number;
  stalled: number;
  lastHeartbeat?: string;
}

export default function SummaryWidget() {
  const { events, loading } = useEvents();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const recent = events.filter(e => new Date(e.ts).getTime() > last24h);
    
    const heartbeat = events.find(e => e.type === 'watchdog.heartbeat');
    
    setSummary({
      total: recent.length,
      tasks: recent.filter(e => e.type.startsWith('task.')).length,
      errors: recent.filter(e => e.level === 'error' || e.type === 'task.failed').length,
      stalled: recent.filter(e => e.type === 'watchdog.stalled').length,
      lastHeartbeat: heartbeat?.ts,
    });
  }, [events]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Events (24h)', value: summary?.total ?? 0, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Tasks', value: summary?.tasks ?? 0, icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Errors', value: summary?.errors ?? 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Stalled', value: summary?.stalled ?? 0, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Last Heartbeat', value: summary?.lastHeartbeat ? new Date(summary.lastHeartbeat).toLocaleTimeString() : 'N/A', icon: Cpu, color: 'text-emerald-600', bg: 'bg-emerald-50', isTime: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={`${card.bg} rounded-lg p-4 border ${card.color.replace('text-', 'border-')} border-opacity-30`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-xs font-medium text-gray-600">{card.label}</span>
            </div>
            <div className={`text-2xl font-bold ${card.color}`}>
              {card.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
