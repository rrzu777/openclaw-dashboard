import ActivityFeed from '@/components/ActivityFeed';
import Calendar from '@/components/Calendar';
import Search from '@/components/Search';
import UsageStats from '@/components/UsageStats';
import SummaryWidget from '@/components/SummaryWidget';
import GatewayControl from '@/components/GatewayControl';
import { collapseAllSections, expandAllSections } from '@/lib/hooks/useCollapsible';

export default function Home() {
  return (
    <main className="min-h-dvh bg-gray-50 text-gray-900 font-sans flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="border-b p-3 flex items-center justify-between bg-white shadow-sm shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold shadow-lg">OC</div>
          <h1 className="text-xl font-bold tracking-tight text-gray-800">Mission Control v1.4</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-sm text-gray-500 items-center bg-white border px-3 py-1.5 rounded-full shadow-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
            <span className="font-medium">System Online</span>
          </div>
          <div className="flex gap-1">
            <button 
              onClick={collapseAllSections}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded border border-gray-200 transition-colors"
              title="Colapsar todas las secciones"
            >
              − All
            </button>
            <button 
              onClick={expandAllSections}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded border border-gray-200 transition-colors"
              title="Expandir todas las secciones"
            >
              + All
            </button>
          </div>
        </div>
      </header>

      {/* Summary Widget */}
      <SummaryWidget />
      
      <div className="flex flex-col xl:flex-row gap-4 p-4 flex-1 min-h-0 overflow-visible">
        
        {/* Left Column: Feed (Flexible) */}
        <div className="flex-1 min-w-0 bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col h-full">
          <ActivityFeed />
        </div>
        
        {/* Right Column: Widgets (Fixed width, Scrollable if needed but better fit) */}
        <div className="w-full xl:w-[480px] space-y-4 shrink-0 flex flex-col h-full overflow-y-auto custom-scrollbar pr-1 pb-2">
          
          {/* Gateway Control */}
          <GatewayControl />

          {/* Search */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden p-1 shrink-0">
            <Search />
          </div>

          {/* Calendar (Expandable Grid) */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden p-1 min-h-[300px] flex flex-col">
             <Calendar />
          </div>

          {/* Usage Stats & Panic */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden p-1 shrink-0">
             <UsageStats />
          </div>

        </div>
      </div>
    </main>
  );
}
