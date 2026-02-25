'use client';

import { useState, useEffect, useCallback } from 'react';
import { GatewayStatus } from '@/lib/types';
import { Power, RotateCcw, Play, Square, RefreshCw, FileText, X, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

export default function GatewayControl() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Poll every 30s
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
      console.error(err);
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
      console.error(err);
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
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b px-4 py-3 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Power className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-gray-800">OpenClaw Gateway</h2>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={clsx('w-2 h-2 rounded-full animate-pulse', getStatusColor())}></span>
          <span className="text-gray-600">{getStatusText()}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Status Info */}
        <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-gray-500 text-xs mb-1">PID</div>
            <div className="font-mono font-medium text-gray-800">
              {status?.pid || '—'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-gray-500 text-xs mb-1">Uptime</div>
            <div className="font-mono font-medium text-gray-800">
              {status?.uptime || '—'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-gray-500 text-xs mb-1">Version</div>
            <div className="font-mono font-medium text-gray-800 truncate" title={status?.version}>
              {status?.version?.split(' ')[0] || '—'}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleAction('start')}
            disabled={loading || actionLoading !== null || status?.running}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              status?.running
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            )}
          >
            {actionLoading === 'start' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Start
          </button>

          <button
            onClick={() => handleAction('stop')}
            disabled={loading || actionLoading !== null || !status?.running}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              !status?.running
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            )}
          >
            {actionLoading === 'stop' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            Stop
          </button>

          <button
            onClick={() => handleAction('restart')}
            disabled={loading || actionLoading !== null}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              actionLoading === 'restart'
                ? 'bg-gray-100 text-gray-400'
                : 'bg-orange-600 text-white hover:bg-orange-700'
            )}
          >
            {actionLoading === 'restart' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Restart
          </button>

          <button
            onClick={handleViewLogs}
            disabled={loading || actionLoading !== null}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              actionLoading === 'logs'
                ? 'bg-gray-100 text-gray-400'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            )}
          >
            {actionLoading === 'logs' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Ver Logs
          </button>

          <button
            onClick={fetchStatus}
            disabled={loading || actionLoading !== null}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              actionLoading
                ? 'bg-gray-100 text-gray-400'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            )}
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Last Updated */}
        <div className="mt-4 text-xs text-gray-400 text-center">
          Last checked: {status?.lastChecked ? new Date(status.lastChecked).toLocaleTimeString() : '—'}
        </div>
      </div>

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Gateway Logs
              </h3>
              <button
                onClick={() => setShowLogs(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-900">
              <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                {logs}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
