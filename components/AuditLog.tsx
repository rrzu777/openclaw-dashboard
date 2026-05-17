'use client';

import { useState, useEffect } from 'react';
import { Shield, ChevronDown, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface AuditEntry {
  id: string;
  ts: string;
  action: string;
  actor: string;
  target?: string;
  ip?: string;
}

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'auditLog', defaultCollapsed: true });

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit?limit=20');
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Audit fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
    const interval = setInterval(fetchAudit, 30000);
    return () => clearInterval(interval);
  }, []);

  const getActionColor = (action: string): 'error' | 'warning' | 'info' => {
    if (action.includes('kill')) return 'error';
    if (action.includes('restart') || action.includes('stop')) return 'warning';
    return 'info';
  };

  return (
    <Card padding="none">
      <SectionHeader
        title="Audit Trail"
        description="Destructive action log"
        icon={<Shield className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); fetchAudit(); }}>
              <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggle(); }}>
              <ChevronDown className={clsx("w-4 h-4 transition-transform", isCollapsed && "-rotate-90")} />
            </Button>
          </div>
        }
        className="px-4 py-3"
      />

      <CardContent className={clsx(
        "transition-all duration-300",
        isCollapsed ? "max-h-0 opacity-0 p-0 overflow-hidden" : "max-h-none opacity-100"
      )}>
        <div className="max-h-64 overflow-y-auto custom-scrollbar">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No audit entries yet</p>
          ) : (
            entries.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 py-2 px-1 border-b border-gray-100 last:border-0 text-xs">
                <Badge variant={getActionColor(entry.action)} size="sm">{entry.action}</Badge>
                <span className="text-gray-500 flex-1 truncate">{entry.target || '—'}</span>
                <span className="text-gray-400 shrink-0">
                  {formatDistanceToNow(new Date(entry.ts), { addSuffix: true })}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
