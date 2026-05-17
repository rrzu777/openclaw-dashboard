'use client';

import { useState, useEffect } from 'react';
import { Shield, ChevronDown, Save, Play } from 'lucide-react';
import { clsx } from 'clsx';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface RecoveryRule { id: string; name: string; condition: string; action: string; cooldownMinutes: number; enabled: boolean; }

export default function RecoveryRules() {
  const [rules, setRules] = useState<RecoveryRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'recoveryRules', defaultCollapsed: true });

  useEffect(() => { fetch('/api/recovery').then(r => r.json()).then(d => setRules(d.rules || [])).catch(() => {}); }, []);

  const toggleRule = (id: string) => { setRules(p => p.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)); setDirty(true); };
  const save = async () => { setSaving(true); try { await fetch('/api/recovery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules }) }); setDirty(false); } catch {} finally { setSaving(false); } };
  const runCheck = async () => { setChecking(true); try { const r = await fetch('/api/recovery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check' }) }); const d = await r.json(); setLastCheck(JSON.stringify(d.results, null, 2)); } catch {} finally { setChecking(false); } };

  const labels: Record<string, string> = { gateway_down: 'Gateway down', high_disk: 'Disk > 90%', stale_heartbeat: 'No heartbeat 15min', restart_gateway: 'Restart gateway', clear_logs: 'Clear old logs', notify_only: 'Notify only' };

  return (
    <Card padding="none">
      <SectionHeader title="Auto-Recovery" description="Automated rules" icon={<Shield className="w-5 h-5" />}
        action={<div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); runCheck(); }} disabled={checking}><Play className={clsx("w-3.5 h-3.5", checking && "animate-pulse")} /></Button>
          {dirty && <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); save(); }} disabled={saving}><Save className="w-3.5 h-3.5" /></Button>}
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggle(); }}><ChevronDown className={clsx("w-4 h-4 transition-transform", isCollapsed && "-rotate-90")} /></Button>
        </div>} className="px-4 py-3" />
      <CardContent className={clsx("transition-all duration-300", isCollapsed ? "max-h-0 opacity-0 p-0 overflow-hidden" : "max-h-none opacity-100")}>
        <div className="space-y-2">
          {rules.map(r => (
            <div key={r.id} className="flex items-center gap-3 p-2 rounded-md border border-gray-200 hover:bg-gray-50">
              <input type="checkbox" checked={r.enabled} onChange={() => toggleRule(r.id)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700">{r.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="default" size="sm">{labels[r.condition] || r.condition}</Badge>
                  <span className="text-[10px] text-gray-400">→</span>
                  <Badge variant="info" size="sm">{labels[r.action] || r.action}</Badge>
                </div>
              </div>
              <Badge variant={r.enabled ? 'success' : 'default'} size="sm">{r.enabled ? 'On' : 'Off'}</Badge>
            </div>
          ))}
        </div>
        {lastCheck && <details className="mt-3"><summary className="text-xs text-gray-500 cursor-pointer">Last check</summary><pre className="mt-1 text-[10px] bg-gray-50 rounded p-2 overflow-auto max-h-32">{lastCheck}</pre></details>}
      </CardContent>
    </Card>
  );
}
