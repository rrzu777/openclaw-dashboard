"use client";

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Terminal, Activity, AlertTriangle, CheckCircle, Clock,
  AlertCircle, Cpu, Hammer, Search, ChevronDown, MessageSquare,
  ListFilter, Rows3, Download
} from 'lucide-react';
import { useEvents } from '@/contexts/EventsContext';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { clsx } from 'clsx';
import type { MCEvent, EventType } from '@/lib/types';

const TYPE_CONFIG: Record<EventType, { icon: any; color: string; bg: string; label: string }> = {
  'task.started': { icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Task Started' },
  'task.checkpoint': { icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Checkpoint' },
  'task.waiting_for_input': { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Waiting' },
  'task.completed': { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Completed' },
  'task.failed': { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', label: 'Failed' },
  'tool.started': { icon: Hammer, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Tool Started' },
  'tool.finished': { icon: Hammer, color: 'text-sky-600', bg: 'bg-sky-50', label: 'Tool Finished' },
  'watchdog.heartbeat': { icon: Cpu, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Heartbeat' },
  'watchdog.stalled': { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', label: 'Stalled' },
  'service.status': { icon: Terminal, color: 'text-slate-600', bg: 'bg-slate-50', label: 'Service' },
  'quota.snapshot': { icon: Search, color: 'text-violet-600', bg: 'bg-violet-50', label: 'Quota' },
};

interface EventItemProps {
  event: MCEvent & { count?: number };
  compact: boolean;
}

function EventItem({ event, compact }: EventItemProps) {
  const config = TYPE_CONFIG[event.type as EventType] || TYPE_CONFIG['service.status'];
  const Icon = config.icon;
  const timeAgo = formatDistanceToNow(new Date(event.ts), { addSuffix: true });

  if (compact) {
    return (
      <div className="flex items-start gap-3 py-2.5 px-3 rounded-md hover:bg-gray-50 transition-colors group">
        <div className={clsx("p-1.5 rounded-md shrink-0", config.bg)}>
          <Icon className={clsx("w-4 h-4", config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-gray-900 truncate">{event.message}</span>
            {event.count && event.count > 1 && (
              <Badge variant="default" size="sm">×{event.count}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{config.label}</span>
            <span>•</span>
            <span>{timeAgo}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors group">
      <div className="flex items-start gap-3">
        <div className={clsx("p-2 rounded-lg shrink-0", config.bg)}>
          <Icon className={clsx("w-5 h-5", config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900">{config.label}</span>
            <span className="text-xs text-gray-500">{timeAgo}</span>
          </div>
          <p className="text-sm text-gray-700 mb-2">{event.message}</p>
          {event.data && Object.keys(event.data).length > 0 && (
            <details className="text-xs">
              <summary className="text-gray-500 cursor-pointer hover:text-gray-700">Show details</summary>
              <pre className="mt-2 p-2 bg-gray-50 rounded text-gray-600 overflow-auto">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActivityFeed() {
  const { events: rawEvents, loading } = useEvents();
  const events = rawEvents as unknown as MCEvent[];
  const [feedActivities, setFeedActivities] = useState<MCEvent[]>([]);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const res = await fetch('/api/feed');
        if (!res.ok) return;
        const data = await res.json();
        // Convert ActivityEvent format to MCEvent-like format for display
        const converted: MCEvent[] = (data.activities || []).map((a: any) => ({
          id: a.id,
          ts: a.timestamp,
          level: a.type === 'error' ? 'error' as const : 'info' as const,
          type: a.type === 'tool' ? 'tool.started' as const
              : a.type === 'error' ? 'task.failed' as const
              : a.type === 'thinking' ? 'task.checkpoint' as const
              : 'service.status' as const,
          message: a.summary,
          data: a.details ? { details: a.details } : undefined,
          actor: 'session',
        }));
        setFeedActivities(converted);
      } catch {
        // silently fail
      }
    };
    fetchFeed();
    const interval = setInterval(fetchFeed, 15000);
    return () => clearInterval(interval);
  }, []);

  // Merge MCEvents from EventsContext with feed activities, deduplicate by id
  const allEvents = (() => {
    const seen = new Set<string>();
    const merged: MCEvent[] = [];
    for (const e of [...events, ...feedActivities]) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      merged.push(e);
    }
    return merged.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  })();

  type FilterType = 'all' | 'tools' | 'messages' | 'errors' | 'system';
  const [filter, setFilter] = useState<FilterType>('all');
  const [mode, setMode] = useState<'verbose' | 'compact'>('compact');
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'activityFeed', defaultCollapsed: false });

  // Stats for filter badges
  const toolCount = allEvents.filter(e => e.type === 'tool.started' || e.type === 'tool.finished').length;
  const msgCount = allEvents.filter(e => e.type === 'task.checkpoint' || (e.type === 'service.status' && e.actor === 'session')).length;
  const errorCount = allEvents.filter(e => e.level === 'error' || e.type === 'task.failed' || e.type === 'watchdog.stalled').length;
  const sysCount = allEvents.filter(e => e.type === 'service.status' && e.actor !== 'session').length;

  // Filter events
  const filteredRaw = allEvents.filter(e => {
    switch (filter) {
      case 'tools': return e.type === 'tool.started' || e.type === 'tool.finished';
      case 'messages': return e.type === 'task.checkpoint' || (e.type === 'service.status' && e.actor === 'session');
      case 'errors': return e.level === 'error' || e.type === 'task.failed' || e.type === 'watchdog.stalled';
      case 'system': return (e.type === 'service.status' && e.actor !== 'session') || e.type === 'watchdog.heartbeat' || e.type === 'quota.snapshot';
      default: return true;
    }
  });

  // Compact mode: group consecutive identical events
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

  return (
    <Card padding="none" className="h-full flex flex-col">
      {/* Header */}
      <SectionHeader
        title="Activity Feed"
        description="Real-time event stream"
        icon={<Terminal className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); window.open('/api/export?format=csv&limit=1000', '_blank'); }}
              title="Export events as CSV"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); toggle(); }}
              icon={<ChevronDown className={clsx("w-4 h-4 transition-transform", isCollapsed && "-rotate-90")} />}
            >
              {isCollapsed ? 'Expand' : 'Collapse'}
            </Button>
          </div>
        }
        className="px-4 py-3"
      />
      
      {/* Filter Controls */}
      <div className={clsx(
        "flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 transition-all duration-300",
        isCollapsed ? "h-0 opacity-0 p-0 overflow-hidden" : "h-auto opacity-100"
      )}>
        <div className="flex items-center gap-1 flex-wrap">
          {([
            { key: 'all' as FilterType, label: 'All', count: allEvents.length, icon: null },
            { key: 'tools' as FilterType, label: 'Tools', count: toolCount, icon: <Hammer className="w-3 h-3" /> },
            { key: 'messages' as FilterType, label: 'Messages', count: msgCount, icon: <MessageSquare className="w-3 h-3" /> },
            { key: 'errors' as FilterType, label: 'Errors', count: errorCount, icon: <AlertTriangle className="w-3 h-3" /> },
            { key: 'system' as FilterType, label: 'System', count: sysCount, icon: <Cpu className="w-3 h-3" /> },
          ]).map(f => (
            <Button
              key={f.key}
              variant={filter === f.key ? 'primary' : 'ghost'}
              size="sm"
              onClick={(e) => { e.stopPropagation(); setFilter(f.key); }}
              icon={f.icon}
            >
              {f.label}
              {f.count > 0 && <span className="ml-1 text-xs opacity-70">({f.count})</span>}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant={mode === 'compact' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={(e) => { e.stopPropagation(); setMode('compact'); }}
            title="Compact view"
          >
            <ListFilter className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant={mode === 'verbose' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={(e) => { e.stopPropagation(); setMode('verbose'); }}
            title="Verbose view"
          >
            <Rows3 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      
      {/* Event List */}
      <CardContent className={clsx(
        "flex-1 overflow-y-auto p-2 transition-all duration-300",
        isCollapsed ? "h-0 opacity-0 p-0 overflow-hidden" : "h-auto opacity-100"
      )}>
        {loading && allEvents.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
              <span className="text-sm">Loading events...</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <div className="text-center">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No events found</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((event: any, idx: number) => (
              <EventItem key={event.id || idx} event={event} compact={mode === 'compact'} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
