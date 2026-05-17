'use client';

import { useState } from 'react';
import { Activity, FileText, Settings, Wrench, TrendingUp, Moon, Sun } from 'lucide-react';
import ActivityFeed from '@/components/ActivityFeed';
import Calendar from '@/components/Calendar';
import Search from '@/components/Search';
import UsageStats from '@/components/UsageStats';
import AuditLog from '@/components/AuditLog';
import AlertConfig from '@/components/AlertConfig';
import SummaryWidget from '@/components/SummaryWidget';
import GatewayControl from '@/components/GatewayControl';
import SystemHealth from '@/components/SystemHealth';
import TrendingChart from '@/components/TrendingChart';
import LiveStatusIndicator from '@/components/LiveStatusIndicator';
import LogsViewer from '@/components/LogsViewer';
import ServicesMonitor from '@/components/ServicesMonitor';
import IncidentTimeline from '@/components/IncidentTimeline';
import RecoveryRules from '@/components/RecoveryRules';
import WebhookConfig from '@/components/WebhookConfig';
import AlertBanner from '@/components/AlertBanner';
import { useTheme } from '@/contexts/ThemeContext';
import { clsx } from 'clsx';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'ops', label: 'Operations', icon: Wrench },
  { id: 'config', label: 'Config', icon: Settings },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function Home() {
  const [tab, setTab] = useState<TabId>('overview');
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <main className="h-dvh bg-gray-50 text-gray-900 font-sans flex flex-col overflow-hidden max-w-[100vw]">
      {/* Header */}
      <header className="border-b p-3 flex items-center justify-between bg-white shadow-sm shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold shadow-lg">OC</div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-800 truncate">Mission Control v2.0</h1>
        </div>
        <button onClick={toggleTheme} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors" title="Toggle theme">
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
        <LiveStatusIndicator />
      </header>

      <AlertBanner />

      {/* Tab Bar */}
      <nav className="bg-white border-b px-2 flex items-center gap-1 overflow-x-auto shrink-0">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                tab === t.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ═══ OVERVIEW ═══ */}
        {tab === 'overview' && (
          <div>
            <SummaryWidget />
            <div className="px-4 py-2">
              <SystemHealth />
            </div>
            <div className="px-4 pb-2">
              <ServicesMonitor />
            </div>
            <div className="px-4 pb-2">
              <IncidentTimeline />
            </div>
            <div className="flex flex-col xl:flex-row gap-4 p-4">
              {/* Left: Calendar + Feed */}
              <div className="flex-1 min-w-0 bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
                <div className="shrink-0 border-b">
                  <Calendar />
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ActivityFeed />
                </div>
              </div>
              {/* Right: Quick widgets */}
              <div className="w-full xl:w-[420px] space-y-4 shrink-0">
                <GatewayControl />
                <div className="rounded-xl border bg-white shadow-sm overflow-hidden p-1">
                  <Search />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ LOGS ═══ */}
        {tab === 'logs' && (
          <div className="p-4 space-y-4">
            <LogsViewer />
            <IncidentTimeline />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <AuditLog />
              <div className="rounded-xl border bg-white shadow-sm overflow-hidden p-1">
                <Search />
              </div>
            </div>
          </div>
        )}

        {/* ═══ TRENDS ═══ */}
        {tab === 'trends' && (
          <div className="p-4 space-y-4">
            <TrendingChart />
            <SummaryWidget />
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden p-1">
              <UsageStats />
            </div>
          </div>
        )}

        {/* ═══ OPERATIONS ═══ */}
        {tab === 'ops' && (
          <div className="p-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="space-y-4">
                <GatewayControl />
                <div className="rounded-xl border bg-white shadow-sm overflow-hidden p-1">
                  <UsageStats />
                </div>
              </div>
              <div className="space-y-4">
                <RecoveryRules />
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <Calendar />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ CONFIG ═══ */}
        {tab === 'config' && (
          <div className="p-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="rounded-xl border bg-white shadow-sm overflow-hidden p-1">
                  <AlertConfig />
                </div>
                <RecoveryRules />
                <WebhookConfig />
              </div>
              <div className="space-y-4">
                <AuditLog />
                <ServicesMonitor />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
