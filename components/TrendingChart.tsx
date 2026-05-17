'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, ChevronDown, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface Snapshot {
  ts: string;
  errors: number;
  tools: number;
  events: number;
  diskPct: number;
  cpuPct: number;
  memMb: number;
  processes: number;
  gatewayUp: boolean;
}

type MetricKey = 'errors' | 'tools' | 'diskPct' | 'cpuPct' | 'memMb' | 'processes';

const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: 'errors', label: 'Errors', color: '#ef4444' },
  { key: 'tools', label: 'Tool Calls', color: '#3b82f6' },
  { key: 'cpuPct', label: 'CPU %', color: '#f59e0b' },
  { key: 'memMb', label: 'Memory (MB)', color: '#8b5cf6' },
  { key: 'diskPct', label: 'Disk %', color: '#10b981' },
  { key: 'processes', label: 'Processes', color: '#06b6d4' },
];

export default function TrendingChart() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(['cpuPct', 'errors']);
  const [hours, setHours] = useState(24);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'trending', defaultCollapsed: false });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/snapshots?hours=${hours}`);
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [hours]);

  const toggleMetric = (key: MetricKey) => {
    setSelectedMetrics(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const chartData = snapshots.map(s => ({
    ...s,
    time: format(new Date(s.ts), 'HH:mm'),
  }));

  return (
    <Card padding="none">
      <SectionHeader
        title="System Trends"
        description={`Last ${hours}h`}
        icon={<TrendingUp className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); fetchData(); }}>
              <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggle(); }}>
              <ChevronDown className={clsx("w-4 h-4 transition-transform", isCollapsed && "-rotate-90")} />
            </Button>
          </div>
        }
        className="px-4 py-3"
      />

      <CardContent className={clsx(
        "transition-all duration-300",
        isCollapsed ? "max-h-0 opacity-0 p-0 overflow-hidden" : "max-h-none opacity-100"
      )}>
        {/* Time range selector */}
        <div className="flex items-center gap-2 mb-3">
          {[6, 12, 24, 48, 72].map(h => (
            <Button
              key={h}
              variant={hours === h ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setHours(h)}
            >
              {h}h
            </Button>
          ))}
        </div>

        {/* Metric toggles */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => toggleMetric(m.key)}
              className={clsx(
                "text-xs px-2 py-1 rounded-full border transition-colors",
                selectedMetrics.includes(m.key)
                  ? "border-current font-medium"
                  : "border-gray-200 text-gray-400 hover:text-gray-600"
              )}
              style={selectedMetrics.includes(m.key) ? { color: m.color, borderColor: m.color } : undefined}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        {snapshots.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No data yet</p>
              <p className="text-xs mt-1">Snapshots are captured every 5 minutes</p>
            </div>
          </div>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" fontSize={10} tick={{ fill: '#9ca3af' }} interval="preserveStartEnd" />
                <YAxis fontSize={10} tick={{ fill: '#9ca3af' }} width={35} />
                <Tooltip
                  contentStyle={{
                    fontSize: '11px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }}
                />
                {METRICS.filter(m => selectedMetrics.includes(m.key)).map(m => (
                  <Line
                    key={m.key}
                    type="monotone"
                    dataKey={m.key}
                    stroke={m.color}
                    strokeWidth={2}
                    dot={false}
                    name={m.label}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
