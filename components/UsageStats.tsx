"use client";

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Zap, ShieldAlert, Skull, RefreshCw, DollarSign } from 'lucide-react';
import { API_ROUTES } from '../lib/config';

interface UsageStatsData {
  opencode?: { cost: number };
  claude?: { daily: number; weekly: number };
}

interface ProcessInfo {
  pid: string;
  command: string;
}

export default function UsageStats() {
  const [stats, setStats] = useState<UsageStatsData | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [selectedPids, setSelectedPids] = useState<string[]>([]);
  const [killing, setKilling] = useState(false);

  const fetchData = async () => {
    try {
      const [usageRes, panicRes] = await Promise.all([
        fetch(API_ROUTES.usage),
        fetch(API_ROUTES.panic)
      ]);
      
      if (usageRes.ok) setStats(await usageRes.json());
      if (panicRes.ok) {
        const pData = await panicRes.json();
        setProcesses(pData.processes || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  const togglePid = (pid: string) => {
    setSelectedPids(prev => 
      prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]
    );
  };

  const handleKill = async (target: string | 'ALL') => {
    if (target === 'ALL' && !confirm("⚠️ NUKE OPTION: Kill ALL agents?")) return;
    setKilling(true);
    try {
      const body = { targets: target === 'ALL' ? 'ALL' : selectedPids };
      await fetch('/api/panic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      await fetchData();
      setSelectedPids([]);
    } catch (e) {
      alert("Kill failed");
    } finally {
      setKilling(false);
    }
  };

  // Prepare Chart Data from Real Stats
  const chartData = [
    { name: 'Claude Daily', value: stats?.claude?.daily || 0, fill: '#ef4444' },
    { name: 'Claude Wkly', value: stats?.claude?.weekly || 0, fill: '#f97316' },
  ];

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gradient-to-br from-indigo-50 to-white p-3 rounded-xl border shadow-sm">
          <div className="text-xs text-gray-500 font-bold mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Opencode Cost
          </div>
          <div className="text-2xl font-black text-indigo-600">
            ${stats?.opencode?.cost?.toFixed(2) || '0.00'}
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-white p-3 rounded-xl border shadow-sm">
          <div className="text-xs text-gray-500 font-bold mb-1 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Claude Limit
          </div>
          <div className="text-2xl font-black text-orange-600">
            {stats?.claude?.daily}%
          </div>
          <div className="text-[10px] text-gray-400">Daily usage</div>
        </div>
      </div>

      {/* Usage Charts */}
      <div className="bg-white p-3 rounded-xl border shadow-sm flex-1 min-h-[150px] flex flex-col">
        <h3 className="text-xs font-bold text-gray-500 mb-2">Usage Breakdown</h3>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" hide />
              <Tooltip cursor={{fill: 'transparent'}} />
              <Bar dataKey="value" barSize={20} radius={[0, 4, 4, 0]} background={{ fill: '#f3f4f6' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Panic Button Select */}
      <div className="bg-red-50 border border-red-100 p-3 rounded-xl">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-bold text-red-900 text-xs flex items-center gap-2">
            <ShieldAlert className="w-3 h-3" /> Active Agents
          </h4>
          <button onClick={fetchData} className="p-1 hover:bg-red-100 rounded">
            <RefreshCw className="w-3 h-3 text-red-400" />
          </button>
        </div>

        <div className="space-y-1 mb-3 max-h-32 overflow-y-auto custom-scrollbar bg-white rounded border border-red-100 p-1">
          {processes.length === 0 && <p className="text-[10px] text-gray-400 italic p-1">No active agents.</p>}
          {processes.map(p => (
            <div key={p.pid} className="flex items-center gap-2 text-xs p-1 hover:bg-red-50 rounded cursor-pointer" onClick={() => togglePid(p.pid)}>
              <input 
                type="checkbox" 
                checked={selectedPids.includes(p.pid)} 
                onChange={() => {}} // Handled by div click
                className="rounded text-red-600 focus:ring-red-500 pointer-events-none"
              />
              <span className="font-mono text-gray-400 w-10">{p.pid}</span>
              <span className="truncate flex-1 text-gray-700" title={p.command}>{p.command}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => handleKill('SELECTIVE')}
            disabled={selectedPids.length === 0 || killing}
            className="flex-1 bg-red-200 hover:bg-red-300 text-red-900 py-1.5 rounded text-xs font-bold disabled:opacity-50 transition-colors"
          >
            Kill ({selectedPids.length})
          </button>
          <button 
            onClick={() => handleKill('ALL')}
            disabled={killing}
            className="w-20 bg-red-600 hover:bg-red-700 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center transition-colors"
          >
            <Skull className="w-3 h-3" /> ALL
          </button>
        </div>
      </div>
    </div>
  );
}
