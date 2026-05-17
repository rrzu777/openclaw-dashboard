'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal as TerminalIcon, Plus, X, Maximize2, Minimize2, Lock, Keyboard } from 'lucide-react';

const CLIS = [
  { id: 'claude', name: 'Claude Code', color: '#d97706', description: 'Anthropic Claude Code CLI' },
  { id: 'opencode', name: 'OpenCode', color: '#7c3aed', description: 'OpenCode AI assistant' },
  { id: 'codex', name: 'Codex CLI', color: '#059669', description: 'OpenAI Codex CLI' },
  { id: 'openclaw', name: 'OpenClaw', color: '#2563eb', description: 'OpenClaw agent framework' },
  { id: 'bash', name: 'Bash', color: '#64748b', description: 'Plain bash shell' },
];

interface TermSession {
  id: string;
  cli: string;
  ws: WebSocket | null;
  pid?: number;
  active: boolean;
}

function TerminalPanel({ session, onClose, isFullscreen, onToggleFullscreen }: {
  session: TermSession;
  onClose: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!termRef.current || !session.ws || loaded) return;

    // Dynamic import xterm (client-only)
    Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
      import('@xterm/addon-web-links'),
    ]).then(([{ Terminal }, { FitAddon }, { WebLinksAddon }]) => {
      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'var(--font-geist-mono), "Cascadia Code", "Fira Code", monospace',
        theme: {
          background: '#0f172a',
          foreground: '#e2e8f0',
          cursor: '#f59e0b',
          selectionBackground: '#334155',
          black: '#1e293b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#f1f5f9',
          brightBlack: '#475569',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#facc15',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#ffffff',
        },
        allowTransparency: false,
        scrollback: 5000,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);

      term.open(termRef.current!);
      fitAddon.fit();

      xtermRef.current = term;
      fitRef.current = fitAddon;

      // WS -> Terminal
      const handleMessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'output') {
            term.write(msg.data);
          } else if (msg.type === 'exit') {
            term.write(`\r\n\x1b[33m[Process exited with code ${msg.data.exitCode}]\x1b[0m\r\n`);
          } else if (msg.type === 'error') {
            term.write(`\r\n\x1b[31m[Error: ${msg.data}]\x1b[0m\r\n`);
          }
        } catch {
          // non-JSON, write raw
        }
      };

      session.ws!.addEventListener('message', handleMessage);

      // Terminal -> WS
      term.onData((data) => {
        if (session.ws?.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({ type: 'input', data }));
        }
      });

      // Resize
      const handleResize = () => {
        fitAddon.fit();
        if (session.ws?.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      };

      const resizeObserver = new ResizeObserver(handleResize);
      if (termRef.current) resizeObserver.observe(termRef.current);

      setLoaded(true);

      return () => {
        session.ws?.removeEventListener('message', handleMessage);
        resizeObserver.disconnect();
        term.dispose();
      };
    });
  }, [session.ws, loaded]);

  // Refit on fullscreen toggle
  useEffect(() => {
    if (fitRef.current) {
      setTimeout(() => fitRef.current?.fit(), 100);
    }
  }, [isFullscreen]);

  const cliConfig = CLIS.find(c => c.id === session.cli) || CLIS[4];
  const [showKeybar, setShowKeybar] = useState(false);

  // Send key to terminal — do NOT refocus xterm (prevents mobile keyboard popping up)
  const sendKey = useCallback((key: string) => {
    if (session.ws?.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify({ type: 'input', data: key }));
    }
  }, [session.ws]);

  const onKey = useCallback((key: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sendKey(key);
  }, [sendKey]);

  const keybarBtn = "px-3 py-2.5 bg-slate-800 active:bg-slate-600 rounded text-slate-300 text-xs font-mono font-bold select-none border border-slate-700 active:border-slate-500 min-w-[40px] text-center";

  return (
    <div className={`flex flex-col bg-[#0f172a] rounded-lg overflow-hidden border border-slate-700 ${isFullscreen ? 'fixed inset-4 z-50' : 'h-full'}`}>
      {/* Tab bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cliConfig.color }} />
          <span className="text-xs font-medium text-slate-300">{cliConfig.name}</span>
          {session.pid && <span className="text-[10px] text-slate-500 font-mono">PID {session.pid}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowKeybar(p => !p)} className={`p-1 rounded transition-colors ${showKeybar ? 'bg-amber-600/30 text-amber-400' : 'hover:bg-slate-700 text-slate-400 hover:text-white'}`} title="Toggle keypad">
            <Keyboard className="w-3.5 h-3.5" />
          </button>
          <button onClick={onToggleFullscreen} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors">
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} className="p-1 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {/* Terminal area */}
      <div ref={termRef} className="flex-1 min-h-0 p-1" />
      {/* Virtual keybar — toggled via keyboard icon */}
      {showKeybar && (
        <div className="shrink-0 bg-slate-900 border-t border-slate-700 px-2 py-1.5 flex flex-wrap gap-1.5">
          {[
            { label: '↑', key: '\x1b[A' },
            { label: '↓', key: '\x1b[B' },
            { label: '←', key: '\x1b[D' },
            { label: '→', key: '\x1b[C' },
            { label: 'Enter', key: '\r' },
            { label: 'Space', key: ' ' },
            { label: 'Tab', key: '\t' },
            { label: 'Esc', key: '\x1b' },
            { label: 'Ctrl+C', key: '\x03' },
            { label: 'Ctrl+D', key: '\x04' },
            { label: 'y', key: 'y' },
            { label: 'n', key: 'n' },
          ].map(k => (
            <div key={k.label} role="button" tabIndex={-1} className={keybarBtn}
              onPointerDown={onKey(k.key)}>{k.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TerminalPage() {
  const [authed, setAuthed] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [sessions, setSessions] = useState<TermSession[]>([]);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if already authed (session storage)
  useEffect(() => {
    const stored = sessionStorage.getItem('mc-terminal-key');
    if (stored) {
      setApiKey(stored);
      setAuthed(true);
    }
  }, []);

  const handleAuth = () => {
    if (apiKey.length >= 8) {
      sessionStorage.setItem('mc-terminal-key', apiKey);
      setAuthed(true);
      setError(null);
    } else {
      setError('Passphrase too short (min 8 chars)');
    }
  };

  const launchSession = useCallback((cli: string) => {
    if (sessions.length >= 4) {
      setError('Max 4 sessions. Close one first.');
      return;
    }

    const wsUrl = `ws://${window.location.hostname}:3001/?cli=${cli}&cwd=/root/.openclaw/workspace&token=${apiKey}`;
    const ws = new WebSocket(wsUrl);
    const id = Math.random().toString(36).slice(2, 10);

    const session: TermSession = { id, cli, ws, active: true };

    ws.onopen = () => {
      setSessions(prev => [...prev, session]);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'session') {
          setSessions(prev => prev.map(s => s.id === id ? { ...s, pid: msg.data.pid } : s));
        } else if (msg.type === 'error') {
          setError(msg.data);
          if (msg.data === 'Unauthorized') {
            sessionStorage.removeItem('mc-terminal-key');
            setAuthed(false);
          }
        }
      } catch {}
    };

    ws.onerror = () => {
      setError('Connection failed. Is the terminal server running?');
    };

    ws.onclose = () => {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, active: false } : s));
    };
  }, [apiKey, sessions.length]);

  const closeSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session?.ws) session.ws.close();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (fullscreenId === id) setFullscreenId(null);
  };

  // Auth screen
  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 max-w-sm w-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-amber-500/10 rounded-lg">
              <Lock className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Pachamama</h1>
              <p className="text-xs text-slate-500">Mission Control Terminal</p>
            </div>
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
            placeholder="Enter passphrase..."
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
            autoFocus
          />
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
          <button
            onClick={handleAuth}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg text-sm transition-colors"
          >
            Authenticate
          </button>
          <p className="text-[10px] text-slate-600 mt-4 text-center">
            Set passphrase: node server/set-passphrase.js
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <div className="w-7 h-7 bg-white/10 rounded-md flex items-center justify-center text-white font-bold text-xs">OC</div>
          </a>
          <div className="w-px h-5 bg-slate-800" />
          <TerminalIcon className="w-4 h-4 text-amber-500" />
          <h1 className="text-sm font-semibold text-white">Terminal</h1>
          <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">{sessions.length}/4 sessions</span>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 bg-red-900/30 border border-red-800 rounded-md text-red-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* CLI Launcher */}
      {sessions.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">
            <h2 className="text-xl font-bold text-white mb-2 text-center">Launch a Session</h2>
            <p className="text-sm text-slate-500 mb-8 text-center">Choose an AI coding CLI to start an interactive session</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {CLIS.map(cli => (
                <button
                  key={cli.id}
                  onClick={() => launchSession(cli.id)}
                  className="group p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-600 transition-all text-left"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cli.color }} />
                    <span className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">{cli.name}</span>
                  </div>
                  <p className="text-xs text-slate-500">{cli.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Terminal panels */}
      {sessions.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0 p-2 gap-2">
          {/* Launcher bar */}
          <div className="flex items-center gap-2 shrink-0">
            {CLIS.map(cli => (
              <button
                key={cli.id}
                onClick={() => launchSession(cli.id)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-md hover:border-slate-600 text-xs text-slate-400 hover:text-white transition-all"
                title={`Launch ${cli.name}`}
              >
                <Plus className="w-3 h-3" />
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cli.color }} />
                <span>{cli.name}</span>
              </button>
            ))}
          </div>

          {/* Terminals grid */}
          <div className={`flex-1 min-h-0 grid gap-2 ${
            sessions.length === 1 ? 'grid-cols-1' :
            sessions.length === 2 ? 'grid-cols-2' :
            sessions.length <= 4 ? 'grid-cols-2 grid-rows-2' :
            'grid-cols-2 grid-rows-2'
          }`}>
            {sessions.map(session => (
              <TerminalPanel
                key={session.id}
                session={session}
                onClose={() => closeSession(session.id)}
                isFullscreen={fullscreenId === session.id}
                onToggleFullscreen={() => setFullscreenId(prev => prev === session.id ? null : session.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
