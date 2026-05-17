'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GatewayStatus } from '@/lib/types';
import { 
  Power, RotateCcw, Play, Square, RefreshCw, FileText, X, Loader2, 
  ChevronDown, Terminal, Activity, Clock, Code, AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';

export default function GatewayControl() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'gatewayControl', defaultCollapsed: false });

  // Quick Commands state
  const [showRealtimeLogs, setShowRealtimeLogs] = useState(false);
  const [realtimeLogs, setRealtimeLogs] = useState<string>('');
  const [showSystemStatus, setShowSystemStatus] = useState(false);
  const [systemStatus, setSystemStatus] = useState<string>('');
  const [showClaudeLogs, setShowClaudeLogs] = useState(false);
  const [claudeLogs, setClaudeLogs] = useState<string>('');
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showRealtimeLogs) {
      const fetchRealtimeLogs = async () => {
        try {
          const res = await fetch('/api/gateway?action=realtime-logs');
          const data = await res.json();
          if (data.success) {
            setRealtimeLogs(prev => prev ? prev + '\n' + (data.logs || '') : (data.logs || ''));
          }
        } catch (err) {
          console.error('Failed to fetch realtime logs:', err);
        }
      };
      fetchRealtimeLogs();
      interval = setInterval(fetchRealtimeLogs, 2000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [showRealtimeLogs]);

  useEffect(() => {
    if (showRealtimeLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [realtimeLogs, showRealtimeLogs]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/gateway');
      const data = await res.json();
      if (data.status) {
        setStatus(data.status);
        setError(null);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch gateway status');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(action);
    setError(null);
    try {
      const res = await fetch('/api/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error || 'Action failed');
      }
    } catch (err) {
      setError('Failed to execute action');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewLogs = async () => {
    setActionLoading('logs');
    setError(null);
    try {
      const res = await fetch('/api/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logs' }),
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || 'No logs available');
        setShowLogs(true);
      } else {
        setError(data.error || 'Failed to fetch logs');
      }
    } catch (err) {
      setError('Failed to fetch logs');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRealtimeLogs = async () => {
    setRealtimeLogs('');
    setShowRealtimeLogs(true);
  };

  const handleSystemStatus = async () => {
    setActionLoading('system-status');
    setShowSystemStatus(true);
    try {
      const res = await fetch('/api/gateway?action=status');
      const data = await res.json();
      setSystemStatus(data.output || 'No status available');
    } catch (err) {
      setSystemStatus('Error fetching status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async () => {
    setShowRestartConfirm(false);
    setActionLoading('restart');
    setError(null);
    try {
      const res = await fetch('/api/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error || 'Restart failed');
      }
    } catch (err) {
      setError('Failed to restart gateway');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClaudeLogs = async () => {
    setActionLoading('claude-logs');
    try {
      const res = await fetch('/api/gateway?action=claude-logs');
      const data = await res.json();
      if (data.success) {
        setClaudeLogs(data.logs || 'No logs available');
        setShowClaudeLogs(true);
      } else {
        setError(data.error || 'Failed to fetch Claude logs');
      }
    } catch (err) {
      setError('Failed to fetch Claude logs');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = () => {
    if (!status) return 'bg-gray-400';
    return status.running ? 'bg-green-500' : 'bg-red-500';
  };

  const getStatusText = () => {
    if (!status) return 'Unknown';
    return status.running ? 'Running' : 'Stopped';
  };

  return (
    <Card padding="none">
      {/* Header */}
      <SectionHeader
        title="OpenClaw Gateway"
        description="Service control panel"
        icon={<Power className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={status?.running ? 'success' : 'error'} size="sm" dot>
              {getStatusText()}
            </Badge>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggle(); }}>
              <ChevronDown className={clsx("w-4 h-4 transition-transform", isCollapsed && "-rotate-90")} />
            </Button>
          </div>
        }
        className="px-4 py-3"
      />
      
      {/* Content */}
      <CardContent className={clsx(
        "px-4 pb-4 transition-all duration-300",
        isCollapsed ? "max-h-0 opacity-0 p-0 overflow-hidden" : "max-h-none opacity-100"
      )}>
        {/* Status Info */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">PID</p>
            <p className="text-lg font-mono font-semibold text-gray-900">{status?.pid || '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Uptime</p>
            <p className="text-lg font-mono font-semibold text-gray-900">{status?.uptime || '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Version</p>
            <p className="text-lg font-mono font-semibold text-gray-900 truncate" title={status?.version}>
              {status?.version?.split(' ')[0] || '—'}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleAction('start')}
            disabled={loading || actionLoading !== null || status?.running}
            icon={actionLoading === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          >
            Start
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={() => handleAction('stop')}
            disabled={loading || actionLoading !== null || !status?.running}
            icon={actionLoading === 'stop' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
          >
            Stop
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleViewLogs}
            disabled={loading || actionLoading !== null}
            icon={actionLoading === 'logs' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          >
            View Logs
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStatus}
            disabled={loading || actionLoading !== null}
            icon={<RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />}
          >
            Refresh
          </Button>
        </div>

        {/* Quick Commands Section */}
        <div className="border-t border-gray-200 pt-4 mt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-gray-500" />
            Quick Commands
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRealtimeLogs}
              disabled={actionLoading !== null}
              icon={<Activity className="w-4 h-4 text-purple-600" />}
            >
              Realtime Logs
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleSystemStatus}
              disabled={actionLoading !== null}
              icon={<Clock className="w-4 h-4 text-indigo-600" />}
            >
              System Status
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowRestartConfirm(true)}
              disabled={actionLoading !== null}
              icon={<RotateCcw className="w-4 h-4 text-orange-600" />}
            >
              Restart
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleClaudeLogs}
              disabled={actionLoading !== null}
              icon={<Code className="w-4 h-4 text-cyan-600" />}
            >
              Claude Logs
            </Button>
          </div>
        </div>

        {/* Last Updated */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            Last checked: {status?.lastChecked ? new Date(status.lastChecked).toLocaleTimeString() : '—'}
          </p>
        </div>
      </CardContent>

      {/* Modals */}
      {showLogs && (
        <Modal title="Gateway Logs" onClose={() => setShowLogs(false)}>
          <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap bg-gray-900 p-4 rounded-lg max-h-96 overflow-auto">
            {logs}
          </pre>
        </Modal>
      )}

      {showRealtimeLogs && (
        <Modal 
          title="Realtime Logs" 
          onClose={() => setShowRealtimeLogs(false)}
          footer="Updating every 2 seconds • Close to stop"
        >
          <div className="text-green-400 text-xs font-mono whitespace-pre-wrap bg-gray-900 p-4 rounded-lg max-h-96 overflow-auto">
            {realtimeLogs || 'Loading logs...'}
            <div ref={logsEndRef} />
          </div>
        </Modal>
      )}

      {showSystemStatus && (
        <Modal title="System Status" onClose={() => setShowSystemStatus(false)}>
          <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap bg-gray-900 p-4 rounded-lg max-h-96 overflow-auto">
            {actionLoading === 'system-status' ? 'Loading...' : systemStatus}
          </pre>
        </Modal>
      )}

      {showRestartConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <RotateCcw className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Confirm Restart</h3>
            </div>
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to restart the gateway? This may cause a temporary service interruption.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowRestartConfirm(false)}>
                Cancel
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={handleRestart}
                disabled={actionLoading === 'restart'}
                icon={actionLoading === 'restart' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              >
                Restart
              </Button>
            </div>
          </div>
        </div>
      )}

      {showClaudeLogs && (
        <Modal title="Claude Code Logs" onClose={() => setShowClaudeLogs(false)}>
          <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap bg-gray-900 p-4 rounded-lg max-h-96 overflow-auto">
            {claudeLogs}
          </pre>
        </Modal>
      )}
    </Card>
  );
}

// Simple Modal component
function Modal({ title, children, footer, onClose }: { title: string; children: React.ReactNode; footer?: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-4">{children}</div>
        {footer && (
          <div className="border-t border-gray-200 px-4 py-2 bg-gray-50 text-xs text-gray-500 text-center">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
