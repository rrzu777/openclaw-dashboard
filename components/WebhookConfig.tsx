'use client';

import { useState, useEffect } from 'react';
import { Webhook, ChevronDown, Save, Plus, Trash2, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface WebhookEntry {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
}

const EVENT_TYPES = ['alert', 'recovery', 'error', 'status'];

export default function WebhookConfig() {
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'webhooks', defaultCollapsed: true });

  useEffect(() => {
    fetch('/api/webhooks').then(r => r.json()).then(d => setWebhooks(d.webhooks || [])).catch(() => {});
  }, []);

  const addWebhook = () => {
    setWebhooks(prev => [...prev, {
      id: Math.random().toString(36).slice(2, 10),
      name: 'New Webhook',
      url: '',
      events: ['alert', 'error'],
      enabled: true,
    }]);
    setDirty(true);
  };

  const removeWebhook = (id: string) => {
    setWebhooks(prev => prev.filter(w => w.id !== id));
    setDirty(true);
  };

  const updateWebhook = (id: string, field: string, value: any) => {
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
    setDirty(true);
  };

  const toggleEvent = (id: string, event: string) => {
    setWebhooks(prev => prev.map(w => {
      if (w.id !== id) return w;
      const events = w.events.includes(event) ? w.events.filter(e => e !== event) : [...w.events, event];
      return { ...w, events };
    }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/webhooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ webhooks }) });
      setDirty(false);
    } catch {} finally { setSaving(false); }
  };

  return (
    <Card padding="none">
      <SectionHeader title="Webhooks" description="External notifications" icon={<Webhook className="w-5 h-5" />}
        action={<div className="flex items-center gap-1">
          {dirty && <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); save(); }} disabled={saving}><Save className="w-3.5 h-3.5" /></Button>}
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggle(); }}>
            <ChevronDown className={clsx("w-4 h-4 transition-transform", isCollapsed && "-rotate-90")} />
          </Button>
        </div>} className="px-4 py-3" />

      <CardContent className={clsx("transition-all duration-300", isCollapsed ? "max-h-0 opacity-0 p-0 overflow-hidden" : "max-h-none opacity-100")}>
        <div className="space-y-3">
          {webhooks.map(wh => (
            <div key={wh.id} className="p-3 border border-gray-200 dark:border-slate-700 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={wh.enabled} onChange={() => updateWebhook(wh.id, 'enabled', !wh.enabled)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                <input type="text" value={wh.name} onChange={(e) => updateWebhook(wh.id, 'name', e.target.value)} className="flex-1 text-xs font-medium border-0 bg-transparent focus:outline-none text-gray-800 dark:text-slate-200" placeholder="Webhook name" />
                <button onClick={() => removeWebhook(wh.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <input type="url" value={wh.url} onChange={(e) => updateWebhook(wh.id, 'url', e.target.value)} className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="https://hooks.slack.com/..." />
              <div className="flex flex-wrap gap-1">
                {EVENT_TYPES.map(evt => (
                  <button key={evt} onClick={() => toggleEvent(wh.id, evt)} className={clsx("text-[10px] px-2 py-0.5 rounded-full border", wh.events.includes(evt) ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600" : "border-gray-200 text-gray-400")}>{evt}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={addWebhook} className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700">
          <Plus className="w-3.5 h-3.5" /> Add webhook
        </button>
      </CardContent>
    </Card>
  );
}
