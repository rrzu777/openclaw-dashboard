'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GatewayStatus } from '@/lib/types';
import { Power, RotateCcw, Play, Square, RefreshCw, FileText, X, Loader2, ChevronDown, Terminal, Activity, Clock, Code } from 'lucide-react';
import { clsx } from 'clsx';
import { useCollapsible } from '@/lib/hooks/useCollapsible';

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

  // Auto-scroll ref for realtime logs
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Polling for realtime logs
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showRealtimeLogs) {
      const fetchRealtimeLogs = async () => {
        try {
          const res = await fetch('/api/gateway?action=realtime-logs');
          const data = await res.json();
          if (data.success) {
            setRealtimeLogs(prev => {
              const newLogs = data.logs || '';
              return prev ? prev + '\n' + newLogs : newLogs;
            });
          }
        } catch (err) {
          console.error('Failed to fetch realtime logs:', err);
        }
      };
      fetchRealtimeLogs();
      interval = setInterval(fetchRealtimeLogs, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showRealtimeLogs]);

  // Auto-scroll to bottom of realtime logs
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

  // Quick Commands handlers
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
      if (data.success) {
        setSystemStatus(data.output || 'No status available');
      } else {
        setSystemStatus(data.error || 'Failed to get status');
      }
    } catch (err) {
      setSystemStatus('Error fetching status');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestartConfirm = () => {
    setShowRestartConfirm(true);
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
        setError(null);
      } else {
        setError(data.error || 'Restart failed');
      }
    } catch (err) {
      setError('Failed to restart gateway');
      console.error(err);
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
      <button 
        onClick={toggle}
        className="w-full border-b px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Power className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-gray-800">OpenClaw Gateway</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={clsx('w-2 h-2 rounded-full animate-pulse', getStatusColor())}></span>
            <span className="text-gray-600">{getStatusText()}</span>
          </div>
          <ChevronDown 
            className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} 
          />
        </div>
      </button>

      {/* Content */}
      <div 
        className={`p-4 overflow-hidden transition-all duration-300 ease-in-out ${
          isCollapsed ? 'max-h-0 opacity-0 p-0' : 'max-h-[800px] opacity-100'
        }`}
      >
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
        <div className="flex flex-wrap gap-2 mb-4">
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

        {/* Quick Commands Section */}
        <div className="border-t pt-4 mt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            Comandos Rápidos
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRealtimeLogs}
              disabled={actionLoading !== null}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                'bg-purple-600 text-white hover:bg-purple-700'
              )}
            >
              <Activity className="w-4 h-4" />
              Logs en Tiempo Real
            </button>

            <button
              onClick={handleSystemStatus}
              disabled={actionLoading !== null}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                'bg-indigo-600 text-white hover:bg-indigo-700'
              )}
            >
              <Clock className="w-4 h-4" />
              Ver Estado
            </button>

            <button
              onClick={handleRestartConfirm}
              disabled={actionLoading !== null}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                'bg-orange-600 text-white hover:bg-orange-700'
              )}
            >
              <RotateCcw className="w-4 h-4" />
              Restart Gateway
            </button>

            <button
              onClick={handleClaudeLogs}
              disabled={actionLoading !== null}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                'bg-cyan-600 text-white hover:bg-cyan-700'
              )}
            >
              <Code className="w-4 h-4" />
              Logs Claude Code
            </button>
          </div>
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

      {/* Realtime Logs Modal */}
      {showRealtimeLogs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Logs en Tiempo Real (openclaw-gateway)
              </h3>
              <button
                onClick={() => setShowRealtimeLogs(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-900 font-mono text-xs">
              <div className="text-green-400 whitespace-pre-wrap">
                {realtimeLogs || 'Cargando logs...'}
              </div>
              <div ref={logsEndRef} />
            </div>
            <div className="border-t px-4 py-2 bg-gray-50 text-xs text-gray-500">
              Actualizando cada 2 segundos • Cierra para detener
            </div>
          </div>
        </div>
      )}

      {/* System Status Expandible */}
      {showSystemStatus && (
        <div className="border-t mt-4 pt-4">
          <button
            onClick={() => setShowSystemStatus(!showSystemStatus)}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Estado del Sistema (systemctl status openclaw-gateway)
            </span>
            <ChevronDown 
              className={`w-5 h-5 text-gray-500 transition-transform ${showSystemStatus ? 'rotate-180' : ''}`} 
            />
          </button>
          {showSystemStatus && (
            <div className="mt-2 p-3 bg-gray-900 rounded-lg overflow-auto max-h-64">
              <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                {actionLoading === 'system-status' ? 'Cargando...' : systemStatus}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Restart Confirmation Modal */}
      {showRestartConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-orange-600" />
              Confirmar Restart
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              ¿Estás seguro de que quieres reiniciar el gateway? Esto puede causar una interrupción temporal del servicio.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRestartConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRestart}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 transition-colors"
              >
                {actionLoading === 'restart' ? (
                  <Loader2 className="w-4 h-4 animate-spin inline" />
                ) : null}
                {' '}Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claude Logs Modal */}
      {showClaudeLogs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Code className="w-5 h-5" />
                Logs de Claude Code
              </h3>
              <button
                onClick={() => setShowClaudeLogs(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-900">
              <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                {claudeLogs}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
