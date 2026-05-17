'use client';

import { useState, useEffect, useRef } from 'react';
import { FileText, ChevronDown, RefreshCw, Search, X, Download, Maximize2, Minimize2, Copy, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';

const SOURCES = [
  { id: 'gateway', label: 'Gateway' },
  { id: 'estrado-api', label: 'Estrado API' },
  { id: 'estrado-worker', label: 'Worker' },
  { id: 'legaltech-monitor', label: 'Monitor' },
  { id: 'resource-tracker', label: 'Resources' },
];

interface LogLine { ts: string; level: string; text: string; }

const lvlColor = (l: string) => l === 'error' ? 'text-red-400' : l === 'warn' ? 'text-amber-400' : 'text-slate-300';

function LogOutput({ lines, scrollRef, className }: { lines: LogLine[]; scrollRef?: React.RefObject<HTMLDivElement | null>; className?: string }) {
  return (
    <div ref={scrollRef} className={clsx("bg-gray-950 rounded-lg p-3 font-mono text-xs overflow-y-auto custom-scrollbar", className)}>
      {lines.length === 0 ? <p className="text-gray-500 text-center py-4">No logs found</p> : lines.map((line, i) => (
        <div key={i} className={clsx("py-0.5 flex gap-2 hover:bg-white/5", lvlColor(line.level))}>
          {line.ts && <span className="text-gray-600 shrink-0 w-20 truncate">{line.ts.split('T')[1]?.split('.')[0] || line.ts.slice(-8)}</span>}
          <span className={clsx("shrink-0 w-10 uppercase text-[10px] font-bold", lvlColor(line.level))}>{line.level}</span>
          <span className="break-all">{line.text}</span>
        </div>
      ))}
    </div>
  );
}

export default function LogsViewer() {
  const [source, setSource] = useState('gateway');
  const [level, setLevel] = useState('all');
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'logsViewer', defaultCollapsed: false });
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ source, lines: '200', level, search });
      const res = await fetch(`/api/logs?${params}`);
      if (res.ok) { const data = await res.json(); setLines(data.lines || []); }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, [source, level]);
  useEffect(() => { if (!autoRefresh) return; const i = setInterval(fetchLogs, 5000); return () => clearInterval(i); }, [autoRefresh, source, level]);

  // Auto-scroll WITHIN the log container only, not the page
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const copyLogs = async () => {
    const text = lines.map(l => `${l.ts} [${l.level}] ${l.text}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for mobile/insecure contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadLogs = () => {
    const text = lines.map(l => `${l.ts} [${l.level}] ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${source}-logs-${new Date().toISOString().split('T')[0]}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card padding="none">
      <SectionHeader title="Logs" description="Unified log viewer" icon={<FileText className="w-5 h-5" />}
        action={<div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); fetchLogs(); }}><RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} /></Button>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggle(); }}><ChevronDown className={clsx("w-4 h-4 transition-transform", isCollapsed && "-rotate-90")} /></Button>
        </div>} className="px-4 py-3" />
      <CardContent className={clsx("transition-all duration-300", isCollapsed ? "max-h-0 opacity-0 p-0 overflow-hidden" : "max-h-none opacity-100")}>
        {/* Source tabs */}
        <div className="flex flex-wrap gap-1 mb-3">
          {SOURCES.map(s => (<Button key={s.id} variant={source === s.id ? 'primary' : 'ghost'} size="sm" onClick={() => setSource(s.id)}>{s.label}</Button>))}
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-1">
            {['all','error','warn','info'].map(l => (
              <button key={l} onClick={() => setLevel(l)} className={clsx("text-xs px-2 py-1 rounded border transition-colors", level === l ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-gray-200 text-gray-400")}>{l === 'all' ? 'All' : l.charAt(0).toUpperCase() + l.slice(1)}</button>
            ))}
          </div>
          <div className="flex-1 min-w-[120px] flex items-center gap-1">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchLogs()} placeholder="Search..." className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
              {search && <button onClick={() => { setSearch(''); fetchLogs(); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-3 h-3" /></button>}
            </div>
          </div>
          <button onClick={() => setAutoRefresh(p => !p)} className={clsx("text-xs px-2 py-1 rounded border", autoRefresh ? "border-green-500 bg-green-500/10 text-green-500" : "border-gray-200 text-gray-400")}>{autoRefresh ? 'Live' : 'Paused'}</button>
        </div>

        {/* Log output */}
        <LogOutput lines={lines} scrollRef={scrollRef} className="max-h-64" />

        {/* Fullscreen modal */}
        {expanded && (
          <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900 shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-white">Logs — {source}</span>
                <span className="text-xs text-slate-500">{lines.length} lines</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={copyLogs} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800">
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button onClick={downloadLogs} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800">
                  <Download className="w-3 h-3" /> Save
                </button>
                <button onClick={() => setExpanded(false)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800">
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs custom-scrollbar">
              {lines.map((line, i) => (
                <div key={i} className={clsx("py-0.5 flex gap-3 hover:bg-white/5", lvlColor(line.level))}>
                  {line.ts && <span className="text-gray-600 shrink-0 w-24">{line.ts.split('T')[1]?.split('.')[0] || line.ts.slice(-8)}</span>}
                  <span className={clsx("shrink-0 w-12 uppercase text-[10px] font-bold", lvlColor(line.level))}>{line.level}</span>
                  <span className="break-all">{line.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer with actions */}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span>{lines.length} lines</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setExpanded(true)} className="flex items-center gap-1 hover:text-gray-600" title="Open fullscreen">
              <Maximize2 className="w-3 h-3" /> Fullscreen
            </button>
            <button onClick={copyLogs} className="flex items-center gap-1 hover:text-gray-600" title="Copy to clipboard">
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={downloadLogs} className="flex items-center gap-1 hover:text-gray-600" title="Download as .log file">
              <Download className="w-3 h-3" /> Save
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
