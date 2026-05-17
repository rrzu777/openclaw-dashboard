"use client";

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Clock, Hammer, Cpu, ChevronDown } from 'lucide-react';
import { useEvents } from '@/contexts/EventsContext';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { clsx } from 'clsx';
import type { MCEvent } from '@/lib/types';

interface Summary {
  total: number;
  tools: number;
  tasks: number;
  errors: number;
  lastHeartbeat?: string;
}

interface StatCard {
  label: string;
  value: number | string;
  icon: any;
  variant: 'default' | 'success' | 'warning' | 'error' | 'info';
  trend?: 'up' | 'down' | 'stable';
}

export default function SummaryWidget() {
  const { events, loading } = useEvents();
  const [summary, setSummary] = useState<Summary | null>(null);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'summaryWidget', defaultCollapsed: false });

  useEffect(() => {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const recent = events.filter(e => new Date(e.ts).getTime() > last24h);
    
    const heartbeat = events.find(e => e.type === 'watchdog.heartbeat');
    
    setSummary({
      total: recent.length,
      tools: recent.filter(e => e.type === 'tool.started' || e.type === 'tool.finished').length,
      tasks: recent.filter(e => e.type.startsWith('task.')).length,
      errors: recent.filter(e => e.level === 'error' || e.type === 'task.failed').length,
      lastHeartbeat: heartbeat?.ts,
    });
  }, [events]);

  if (loading) {
    return (
      <div className="border-b bg-white">
        <div className="px-4 py-3">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  const cards: StatCard[] = [
    {
      label: 'Events (24h)',
      value: summary?.total ?? 0,
      icon: Activity,
      variant: 'info',
    },
    {
      label: 'Tool Calls',
      value: summary?.tools ?? 0,
      icon: Hammer,
      variant: 'default',
    },
    {
      label: 'Tasks',
      value: summary?.tasks ?? 0,
      icon: Clock,
      variant: 'default',
    },
    {
      label: 'Errors',
      value: summary?.errors ?? 0,
      icon: AlertTriangle,
      variant: 'error',
    },
    {
      label: 'Last Heartbeat',
      value: summary?.lastHeartbeat ? new Date(summary.lastHeartbeat).toLocaleTimeString() : 'N/A',
      icon: Cpu,
      variant: 'success',
    },
  ];

  return (
    <div className="border-b bg-white">
      {/* Header */}
      <button 
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors duration-200"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <h2 className="text-base font-semibold text-gray-900">Summary</h2>
            <p className="text-xs text-gray-500">Activity overview</p>
          </div>
        </div>
        <ChevronDown 
          className={clsx(
            "w-5 h-5 text-gray-400 transition-transform duration-200",
            isCollapsed ? "-rotate-90" : "rotate-0"
          )} 
        />
      </button>
      
      {/* Collapsible Content */}
      <div 
        className={clsx(
          "grid grid-cols-2 md:grid-cols-5 gap-3 p-4 overflow-hidden transition-all duration-300 ease-in-out",
          isCollapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100"
        )}
      >
        {cards.map((card) => {
          const Icon = card.icon;
          const isNumeric = typeof card.value === 'number';
          
          return (
            <Card key={card.label} padding="md" hover className="group">
              <div className="flex items-center gap-2 mb-2">
                <div className={clsx(
                  "p-1.5 rounded-md",
                  card.variant === 'info' && "bg-blue-50",
                  card.variant === 'success' && "bg-green-50",
                  card.variant === 'warning' && "bg-amber-50",
                  card.variant === 'error' && "bg-red-50",
                  card.variant === 'default' && "bg-gray-50"
                )}>
                  <Icon className={clsx(
                    "w-4 h-4",
                    card.variant === 'info' && "text-blue-600",
                    card.variant === 'success' && "text-green-600",
                    card.variant === 'warning' && "text-amber-600",
                    card.variant === 'error' && "text-red-600",
                    card.variant === 'default' && "text-gray-600"
                  )} />
                </div>
                <span className="text-xs font-medium text-gray-600">{card.label}</span>
              </div>
              
              <div className="flex items-baseline gap-2">
                <span className={clsx(
                  "text-2xl font-bold",
                  card.variant === 'info' && "text-blue-600",
                  card.variant === 'success' && "text-green-600",
                  card.variant === 'warning' && "text-amber-600",
                  card.variant === 'error' && "text-red-600",
                  card.variant === 'default' && "text-gray-900"
                )}>
                  {card.value}
                </span>
                {isNumeric && card.value === 0 && (
                  <span className="text-xs text-gray-400">None</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
