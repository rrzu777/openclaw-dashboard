'use client';

import { useState, useEffect } from 'react';
import { Server, ChevronDown, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface ServiceStatus { name: string; displayName: string; running: boolean; pid?: number; memory?: string; uptime?: string; group: string; }

export default function ServicesMonitor() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'services', defaultCollapsed: false });

  const fetch_ = async () => { setLoading(true); try { const r = await fetch('/api/services'); if (r.ok) { const d = await r.json(); setServices(d.services || []); } } catch {} finally { setLoading(false); } };
  useEffect(() => { fetch_(); const i = setInterval(fetch_, 30000); return () => clearInterval(i); }, []);

  const groups = [{ id: 'openclaw', label: 'OpenClaw' }, { id: 'legaltech', label: 'LegalTech' }];

  return (
    <Card padding="none">
      <SectionHeader title="Services" description="All VPS services" icon={<Server className="w-5 h-5" />}
        action={<div className="flex items-center gap-1">
          <Badge variant={services.length > 0 && services.every(s => s.running) ? 'success' : 'error'} size="sm" dot>{services.filter(s => s.running).length}/{services.length}</Badge>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); fetch_(); }}><RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} /></Button>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggle(); }}><ChevronDown className={clsx("w-4 h-4 transition-transform", isCollapsed && "-rotate-90")} /></Button>
        </div>} className="px-4 py-3" />
      <CardContent className={clsx("transition-all duration-300", isCollapsed ? "max-h-0 opacity-0 p-0 overflow-hidden" : "max-h-none opacity-100")}>
        {groups.map(g => {
          const svcs = services.filter(s => s.group === g.id);
          if (!svcs.length) return null;
          return (<div key={g.id} className="mb-3 last:mb-0">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">{g.label}</h4>
            <div className="space-y-1.5">{svcs.map(s => (
              <div key={s.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-md border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className={clsx("w-2 h-2 rounded-full", s.running ? "bg-green-500" : "bg-red-500")} />
                  <span className="text-sm font-medium text-gray-800">{s.displayName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {s.memory && <span className="font-mono">{s.memory}</span>}
                  {s.uptime && <span className="font-mono">{s.uptime}</span>}
                  <Badge variant={s.running ? 'success' : 'error'} size="sm">{s.running ? 'up' : 'down'}</Badge>
                </div>
              </div>
            ))}</div>
          </div>);
        })}
      </CardContent>
    </Card>
  );
}
