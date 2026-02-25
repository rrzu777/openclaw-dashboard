"use client";

import { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow } from 'date-fns';
import { 
  Terminal, Activity, AlertTriangle, CheckCircle, Clock, 
  AlertCircle, Cpu, Hammer, Search
} from 'lucide-react';
import { useEvents } from '@/contexts/EventsContext';

type EventLevel = 'info' | 'warn' | 'error';
type EventType =
  | 'task.started'
  | 'task.checkpoint'
  | 'task.waiting_for_input'
  | 'task.completed'
  | 'task.failed'
  | 'tool.started'
  | 'tool.finished'
  | 'watchdog.heartbeat'
  | 'watchdog.stalled'
  | 'service.status'
  | 'quota.snapshot';

interface MCEvent {
  id: string;
  ts: string;
  level: EventLevel;
  type: EventType;
  message: string;
  taskId?: string;
  actor?: string;
  data?: any;
}

const TYPE_CONFIG: Record<EventType, { icon: any; color: string; bg: string; border: string }> = {
  'task.started': { icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  'task.checkpoint': { icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  'task.waiting_for_input': { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  'task.completed': { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  'task.failed': { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  'tool.started': { icon: Hammer, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  'tool.finished': { icon: Hammer, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
  'watchdog.heartbeat': { icon: Cpu, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'watchdog.stalled': { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  'service.status': { icon: Terminal, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
  'quota.snapshot': { icon: Search, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
};

export default function ActivityFeed() {
  const { events: rawEvents, loading } = useEvents();
  const events = rawEvents as unknown as MCEvent[];
  const [filter, setFilter] = useState<'all' | 'errors' | 'tasks'>('all');
  const [mode, setMode] = useState<'verbose' | 'compact'>('compact');

  // Filter events
  const filteredRaw = events.filter(e => {
    if (filter === 'errors') return e.level === 'error' || e.type.includes('failed') || e.type.includes('stalled');
    if (filter === 'tasks') return e.type.startsWith('task.');
    return true;
  });

  // Compact mode: group consecutive identical (type+message) bursts
  const filtered = (() => {
    if (mode === 'verbose') return filteredRaw;
    const out: (MCEvent & { count?: number })[] = [];
    for (const e of filteredRaw) {
      const prev = out[out.length - 1];
      const sigA = `${prev?.type ?? ''}:${prev?.data?.tool ?? ''}:${prev?.message ?? ''}`;
      const sigB = `${e.type}:${e.data?.tool ?? ''}:${e.message}`;
      if (prev && sigA === sigB) {
        prev.count = (prev.count ?? 1) + 1;
        continue;
      }
      out.push({ ...e, count: 1 });
    }
    return out;
  })();

  // Stats
  const errorCount = events.filter(e => e.level === 'error' || e.type === 'task.failed' || e.type === 'watchdog.stalled').length;
  const taskCount = events.filter(e => e.type.startsWith('task.')).length;
  const stalledCount = events.filter(e => e.type === 'watchdog.stalled').length;

  return (
    <div className="flex flex-col h-full w-full p-4">
      {/* Header with Stats */}
      <div className="flex justify-between items-center mb-4 shrink-0">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Terminal className="w-5 h-5 text-purple-500" />
          Activity Feed
        </h2>
        <div className="flex gap-2 text-xs">
          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 font-medium">
            {taskCount} Tasks
          </span>
          {errorCount > 0 && (
            <span className="bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100 font-medium">
              {errorCount} Errors
            </span>
          )}
          {stalledCount > 0 && (
            <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100 font-medium">
              {stalledCount} Stalled
            </span>
          )}
        </div>
      </div>

      {/* Filter + Mode */}
      <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
        <div className="flex gap-1">
          {(['all', 'tasks', 'errors'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={twMerge(
                "px-3 py-1 rounded text-xs font-medium transition-colors",
                filter === f
                  ? "bg-purple-100 text-purple-700 border border-purple-200"
                  : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {(['compact', 'verbose'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={twMerge(
                "px-3 py-1 rounded text-xs font-medium transition-colors",
                mode === m
                  ? "bg-gray-900 text-white border border-gray-900"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              )}
              title={m === 'compact' ? 'Group repeated events' : 'Show all events'}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      
      {/* Scrollable List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 min-h-0">
        {loading && events.length === 0 && (
          <div className="flex justify-center items-center h-full text-gray-400 animate-pulse">
            Loading events...
          </div>
        )}

        {filtered.map((event: any) => {
          const typeKey = (event.type as EventType) in TYPE_CONFIG ? (event.type as EventType) : 'service.status';
          const config = TYPE_CONFIG[typeKey];
          const Icon = config.icon;

          const toolName = event.data?.tool;
          const hasDetails = !!event.data && Object.keys(event.data).length > 0;

          return (
            <details
              key={event.id}
              className={twMerge(
                "group rounded-lg border text-sm transition-all",
                config.bg,
                config.border
              )}
            >
              <summary className="list-none cursor-pointer select-none">
                <div className={twMerge("flex gap-3 p-3")}>
                    <div className="mt-0.5 shrink-0">
                      <Icon className={twMerge("w-4 h-4", config.color)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={twMerge("font-medium truncate", config.color)}>
                            {event.type}
                          </span>
                          {toolName && (
                            <span className="text-xs text-gray-700 bg-white/60 border border-black/10 px-2 py-0.5 rounded shrink-0 font-mono">
                              {toolName}
                            </span>
                          )}
                          {event.taskId && (
                            <span className="text-xs text-gray-500 font-mono shrink-0">#{event.taskId}</span>
                          )}
                          {mode === 'compact' && event.count && event.count > 1 && (
                            <span className="text-[10px] bg-black/10 px-1.5 py-0.5 rounded shrink-0">×{event.count}</span>
                          )}
                        </div>
                        <span className="text-xs opacity-60 shrink-0 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(event.ts), { addSuffix: true })}
                        </span>
                      </div>

                      <div className="text-gray-800 text-sm">{event.message}</div>

                      {event.actor && (
                        <div className="mt-1 text-xs text-gray-500">
                          Actor: <span className="font-mono">{event.actor}</span>
                        </div>
                      )}
                    </div>
                  </div>
              </summary>

              {hasDetails && (
                <div className="px-3 pb-3">
                  <div className="bg-white/70 border border-black/5 rounded p-2 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-64">
                    {JSON.stringify(event.data, null, 2)}
                  </div>
                </div>
              )}
            </details>
          );
        })}

        {filtered.length === 0 && !loading && (
          <div className="flex justify-center items-center h-full text-gray-400">
            No events matching filter
          </div>
        )}
      </div>
    </div>
  );
}
