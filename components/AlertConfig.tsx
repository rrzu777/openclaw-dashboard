'use client';

import { useState, useEffect } from 'react';
import { Bell, ChevronDown, Save } from 'lucide-react';
import { clsx } from 'clsx';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface AlertThreshold {
  id: string;
  metric: string;
  operator: string;
  value: number;
  enabled: boolean;
  description: string;
}

export default function AlertConfig() {
  const [alerts, setAlerts] = useState<AlertThreshold[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'alertConfig', defaultCollapsed: true });

  useEffect(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(d => setAlerts(d.alerts || []))
      .catch(() => {});
  }, []);

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    setDirty(true);
  };

  const updateValue = (id: string, value: number) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, value } : a));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerts }),
      });
      setDirty(false);
    } catch {
      // Handle error silently
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="none">
      <SectionHeader
        title="Alert Thresholds"
        description="Configure monitoring alerts"
        icon={<Bell className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-1">
            {dirty && (
              <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); save(); }} disabled={saving}>
                <Save className="w-3.5 h-3.5 mr-1" />
                Save
              </Button>
            )}
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
        <div className="space-y-3">
          {alerts.map(alert => (
            <div key={alert.id} className="flex items-center gap-3 p-2 rounded-md border border-gray-200 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={alert.enabled}
                onChange={() => toggleAlert(alert.id)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700">{alert.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="default" size="sm">{alert.metric}</Badge>
                  <span className="text-xs text-gray-500">{alert.operator}</span>
                  <input
                    type="number"
                    value={alert.value}
                    onChange={(e) => updateValue(alert.id, Number(e.target.value))}
                    className="w-16 text-xs border rounded px-1.5 py-0.5"
                    disabled={!alert.enabled}
                  />
                </div>
              </div>
              <Badge variant={alert.enabled ? 'success' : 'default'} size="sm">
                {alert.enabled ? 'Active' : 'Off'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
