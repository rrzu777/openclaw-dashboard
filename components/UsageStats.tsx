"use client";

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, Zap, ShieldAlert, RefreshCw, ChevronDown, AlertCircle, DollarSign, Cpu, MemoryStick } from 'lucide-react';
import { clsx } from 'clsx';
import { API_ROUTES } from '../lib/config';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface UsageStatsData {
  gateway?: { running: boolean; status: string };
  aiProcesses?: { count: number; details: string[] };
  opencode?: { status: string; note: string };
  raw_output?: string;
}

interface ProcessInfo {
  pid: string;
  user: string;
  cpu: string;
  mem: string;
  command: string;
}

export default function UsageStats() {
  const [stats, setStats] = useState<UsageStatsData | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [selectedPids, setSelectedPids] = useState<string[]>([]);
  const [killing, setKilling] = useState(false);
  const [showKillAllConfirm, setShowKillAllConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'usageStats', defaultCollapsed: false });

  const fetchData = async () => {
    try {
      // Fetch processes (fast, reliable)
      try {
        const panicRes = await fetch(API_ROUTES.panic, { signal: AbortSignal.timeout(3000) });
        if (panicRes.ok) {
          const pData = await panicRes.json();
          setProcesses(pData.processes || []);
        }
      } catch (e) {
        console.error('Panic API error:', e);
      }
      
      // Fetch usage (may timeout - don't block)
      try {
        const usageRes = await fetch(API_ROUTES.usage, { signal: AbortSignal.timeout(3000) });
        if (usageRes.ok) {
          const usageData = await usageRes.json();
          setStats(usageData);
        } else {
          setStats(null);
        }
      } catch (e) {
        console.error('Usage API timeout, using defaults');
        setStats(null);
      }
    } catch (e) {
      console.error('Fetch error:', e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const togglePid = (pid: string) => {
    setSelectedPids(prev => 
      prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]
    );
  };

  const handleKill = async (target: string | 'ALL' | 'SELECTED') => {
    if (target === 'ALL') {
      setShowKillAllConfirm(true);
      return;
    }
    await executeKill(target);
  };

  const executeKill = async (target: string | 'ALL' | 'SELECTED') => {
    setShowKillAllConfirm(false);
    setKilling(true);
    setError(null);
    try {
      const body = {
        targets: target === 'ALL' ? 'ALL' : target === 'SELECTED' ? selectedPids : target
      };
      await fetch('/api/panic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      await fetchData();
      setSelectedPids([]);
    } catch {
      setError('Kill command failed');
    } finally {
      setKilling(false);
    }
  };

  // Prepare chart data (use processes count if available)
  const chartData = processes && processes.length > 0
    ? [
        { name: 'Processes', value: processes.length, fill: '#3b82f6' },
        { name: 'Gateway', value: 1, fill: '#10b981' },
      ]
    : [
        { name: 'OpenClaw', value: 1, fill: '#3b82f6' },
      ];

  return (
    <Card padding="none">
      {/* Header */}
      <SectionHeader
        title="Usage Stats"
        description="AI processes & resource usage"
        icon={<Activity className="w-5 h-5" />}
        action={
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggle(); }}>
            <ChevronDown className={clsx("w-4 h-4 transition-transform", isCollapsed && "-rotate-90")} />
          </Button>
        }
        className="px-4 py-3"
      />
      
      {/* Content */}
      <CardContent className={clsx(
        "transition-all duration-300",
        isCollapsed ? "max-h-0 opacity-0 p-0 overflow-hidden" : "max-h-none opacity-100"
      )}>
        {/* Status Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-green-50">
                <Zap className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-xs font-medium text-gray-600">Gateway</span>
            </div>
            <Badge variant="success" size="sm" dot>
              Running
            </Badge>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-blue-50">
                <Cpu className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-gray-600">Processes</span>
            </div>
            <p className="text-lg font-bold text-blue-600">
              {processes.length}
            </p>
          </div>
        </div>

        {/* Usage Chart */}
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-600 mb-2">Resource Overview</h4>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" fontSize={10} tick={{ fill: '#6b7280' }} />
                <Tooltip 
                  contentStyle={{ 
                    fontSize: '11px', 
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }} 
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Process List */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Active Processes
            </h4>
            {selectedPids.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleKill('SELECTED')}
                disabled={killing}
                icon={killing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              >
                Kill Selected ({selectedPids.length})
              </Button>
            )}
          </div>
          
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {processes.length > 0 ? (
              processes.slice(0, 20).map((p) => (
                <div
                  key={p.pid}
                  className={clsx(
                    "flex items-center justify-between p-2 text-xs border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors",
                    selectedPids.includes(p.pid) && "bg-blue-50 border-blue-200"
                  )}
                  onClick={() => togglePid(p.pid)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedPids.includes(p.pid)}
                      onChange={() => togglePid(p.pid)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-mono text-gray-600 w-12 shrink-0">{p.pid}</span>
                    <span className="truncate flex-1 text-gray-700">{p.command}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-xs text-gray-500 w-10 text-right">{p.cpu}%</span>
                    <span className="font-mono text-xs text-gray-500 w-10 text-right">{p.mem}%</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-24 text-gray-400">
                <div className="text-center">
                  <Activity className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No AI processes detected</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* OpenCode Status - Simplified */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-purple-50">
                <DollarSign className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-xs font-medium text-gray-600">OpenCode</span>
            </div>
            <Badge variant="info" size="sm">
              Installed
            </Badge>
          </div>
        </div>
      </CardContent>

      {error && (
        <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {showKillAllConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-red-600 mb-2">Kill ALL Agents?</h3>
            <p className="text-sm text-gray-600 mb-4">This will terminate all running AI processes. This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowKillAllConfirm(false)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => executeKill('ALL')}>Kill All</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
