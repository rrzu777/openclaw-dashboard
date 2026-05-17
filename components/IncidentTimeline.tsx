'use client';

import { useState, useEffect } from 'react';
import { Clock, ChevronDown, RefreshCw, AlertTriangle, CheckCircle, Info, Shield, Zap } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { clsx } from 'clsx';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface TimelineEntry {
  ts: string;
  source: 'event' | 'audit' | 'recovery';
  level: 'info' | 'warn' | 'error' | 'success';
  title: string;
  detail?: string;
}

const levelConfig = {
  error: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', line: 'bg-red-300' },
  warn: { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', line: 'bg-amber-300' },
  success: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', line: 'bg-green-300' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', line: 'bg-blue-300' },
};

const sourceLabel = { event: 'System', audit: 'Audit', recovery: 'Recovery' };

export default function IncidentTimeline() {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'incidentTimeline', defaultCollapsed: false });

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/incidents?hours=${hours}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.timeline || []);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchTimeline(); }, [hours]);

  return (
    <Card padding="none">
      <SectionHeader title="Incident Timeline" description="Correlated event history"
        icon={<Clock className="w-5 h-5" />}
        action={<div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); fetchTimeline(); }}>
            <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggle(); }}>
            <ChevronDown className={clsx("w-4 h-4 transition-transform", isCollapsed && "-rotate-90")} />
          </Button>
        </div>} className="px-4 py-3" />

      <CardContent className={clsx("transition-all duration-300", isCollapsed ? "max-h-0 opacity-0 p-0 overflow-hidden" : "max-h-none opacity-100")}>
        {/* Time range */}
        <div className="flex items-center gap-2 mb-4">
          {[6, 12, 24, 48, 72].map(h => (
            <Button key={h} variant={hours === h ? 'primary' : 'ghost'} size="sm" onClick={() => setHours(h)}>
              {h}h
            </Button>
          ))}
        </div>

        {/* Timeline */}
        <div className="relative max-h-96 overflow-y-auto custom-scrollbar">
          {entries.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">All clear — no incidents</p>
            </div>
          ) : (
            <div className="space-y-0">
              {entries.map((entry, i) => {
                const config = levelConfig[entry.level];
                const Icon = config.icon;
                const isLast = i === entries.length - 1;

                return (
                  <div key={`${entry.ts}-${i}`} className="flex gap-3 group">
                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center shrink-0 w-6">
                      <div className={clsx("w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 shrink-0 z-10", config.line)} />
                      {!isLast && <div className="w-0.5 flex-1 bg-gray-200 dark:bg-slate-700 -mt-px" />}
                    </div>

                    {/* Content */}
                    <div className={clsx("flex-1 pb-4 min-w-0", isLast && "pb-0")}>
                      <div className="flex items-start gap-2 mb-0.5">
                        <Icon className={clsx("w-3.5 h-3.5 shrink-0 mt-0.5", config.color)} />
                        <p className="text-sm text-gray-800 dark:text-slate-200 flex-1 min-w-0">{entry.title}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-5.5 text-xs text-gray-500">
                        <span>{format(new Date(entry.ts), 'HH:mm:ss')}</span>
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(entry.ts), { addSuffix: true })}</span>
                        <Badge variant="default" size="sm">{sourceLabel[entry.source]}</Badge>
                      </div>
                      {entry.detail && (
                        <p className="text-xs text-gray-400 ml-5.5 mt-0.5 truncate">{entry.detail}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
