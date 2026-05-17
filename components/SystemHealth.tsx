'use client';

import { useState, useEffect } from 'react';
import { 
  Activity, Server, Shield, RefreshCw, ChevronDown,
  AlertTriangle, CheckCircle, XCircle, Cpu, HardDrive
} from 'lucide-react';
import { clsx } from 'clsx';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface HealthData {
  gateway: {
    running: boolean;
    pid?: number;
    cpu?: string;
    memory?: string;
    uptime?: string;
    responsive: boolean;
  };
  dashboard: {
    running: boolean;
    pid?: number;
    cpu?: string;
    memory?: string;
    uptime?: string;
  };
  watchdog: {
    running: boolean;
    lastCheck?: string;
    lastStatus?: string;
    recentRestarts?: number;
  };
  pm2Processes: {
    name: string;
    status: string;
    cpu: string;
    memory: string;
    uptime: string;
  }[];
  diskUsage: {
    total: string;
    used: string;
    available: string;
    percent: string;
  };
  timestamp: string;
}

export default function SystemHealth() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'systemHealth', defaultCollapsed: false });

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system-health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card padding="none">
      {/* Header with collapse */}
      <button 
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors duration-200"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <h2 className="text-base font-semibold text-gray-900">System Health</h2>
            <p className="text-xs text-gray-500">Real-time system monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={(e) => { e.stopPropagation(); fetchHealth(); }}
            icon={<RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />}
          >
            Refresh
          </Button>
          <ChevronDown className={clsx("w-5 h-5 text-gray-400 transition-transform duration-200", isCollapsed ? "-rotate-90" : "rotate-0")} />
        </div>
      </button>

      {/* Collapsible Content */}
      <div className={clsx(
        "px-4 pb-4 transition-all duration-300 overflow-hidden",
        isCollapsed ? "max-h-0 opacity-0" : "max-h-[1000px] opacity-100"
      )}>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        {health && (
          <div className="space-y-4">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <StatusCard
                title="Gateway"
                status={health.gateway.responsive ? 'online' : 'offline'}
                icon={Server}
                metrics={[
                  { label: 'PID', value: health.gateway.pid || 'N/A' },
                  { label: 'CPU', value: health.gateway.cpu || 'N/A' },
                ].slice(0, 2)}
              />
              
              <StatusCard
                title="Dashboard"
                status={health.dashboard.running ? 'online' : 'offline'}
                icon={Activity}
                metrics={[
                  { label: 'PID', value: health.dashboard.pid || 'N/A' },
                  { label: 'CPU', value: health.dashboard.cpu || 'N/A' },
                ].slice(0, 2)}
              />
              
              <StatusCard
                title="Watchdog"
                status={health.watchdog.running ? 'online' : 'offline'}
                icon={Shield}
                metrics={[
                  { label: 'Last Check', value: health.watchdog.lastCheck || 'N/A' },
                  { label: 'Status', value: health.watchdog.lastStatus || 'N/A' },
                ].slice(0, 2)}
              />
            </div>

            {/* PM2 Processes Table */}
            {health.pm2Processes.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-gray-500" />
                  PM2 Processes
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Name</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">CPU</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Memory</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Uptime</th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.pm2Processes.map((proc, idx) => (
                        <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="py-2 px-3 font-medium text-gray-900">{proc.name}</td>
                          <td className="py-2 px-3">
                            <Badge 
                              variant={proc.status === 'online' ? 'success' : 'error'}
                              size="sm"
                              dot
                            >
                              {proc.status}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-gray-600">{proc.cpu}</td>
                          <td className="py-2 px-3 font-mono text-xs text-gray-600">{proc.memory}</td>
                          <td className="py-2 px-3 font-mono text-xs text-gray-500">{proc.uptime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Disk Usage */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-gray-500" />
                Disk Usage
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Total</p>
                  <p className="text-lg font-semibold text-gray-900">{health.diskUsage.total}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Used</p>
                  <p className="text-lg font-semibold text-gray-900">{health.diskUsage.used}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Available</p>
                  <p className="text-lg font-semibold text-gray-900">{health.diskUsage.available}</p>
                </div>
                <div className={clsx(
                  "rounded-lg p-3 border",
                  (parseInt(health.diskUsage.percent.replace('%', '')) || 0) > 80
                    ? "bg-red-50 border-red-200"
                    : "bg-gray-50 border-gray-200"
                )}>
                  <p className="text-xs text-gray-500 mb-1">Usage</p>
                  <p className={clsx(
                    "text-lg font-semibold",
                    (parseInt(health.diskUsage.percent.replace('%', '')) || 0) > 80
                      ? "text-red-600"
                      : "text-gray-900"
                  )}>{health.diskUsage.percent}</p>
                </div>
              </div>
            </div>

            {/* Timestamp */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">
                Last updated: {new Date(health.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// Helper component
function StatusCard({ title, status, icon: Icon, metrics }: { 
  title: string; 
  status: 'online' | 'offline'; 
  icon: any; 
  metrics?: Array<{ label: string; value: string | number }> 
}) {
  return (
    <Card padding="md" className="h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={clsx(
            "p-2 rounded-lg",
            status === 'online' ? "bg-green-50" : "bg-red-50"
          )}>
            <Icon className={clsx(
              "w-5 h-5",
              status === 'online' ? "text-green-600" : "text-red-600"
            )} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
            <Badge 
              variant={status === 'online' ? 'success' : 'error'}
              size="sm"
              dot
            >
              {status === 'online' ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </div>
      </div>
      
      {metrics && metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
          {metrics.map((metric, idx) => (
            <div key={idx}>
              <p className="text-xs text-gray-500">{metric.label}</p>
              <p className="text-sm font-medium text-gray-900">{metric.value}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
