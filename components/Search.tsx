"use client";

import { useState, useEffect } from 'react';
import { Search as SearchIcon, FileText, Loader2, X, ChevronDown } from 'lucide-react';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { clsx } from 'clsx';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'search', defaultCollapsed: false });

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 3) {
      setResults([]);
      return;
    }

    const search = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    };

    search();
  }, [debouncedQuery]);

  return (
    <Card padding="none">
      {/* Header */}
      <SectionHeader
        title="Global Search"
        description="Search across all data"
        icon={<SearchIcon className="w-5 h-5" />}
        action={
          <button onClick={(e) => { e.stopPropagation(); toggle(); }}>
            <ChevronDown className={clsx("w-5 h-5 text-gray-500 transition-transform duration-300", isCollapsed ? "-rotate-90" : "rotate-0")} />
          </button>
        }
        className="px-4 py-3"
      />
      
      {/* Content */}
      <CardContent className={clsx(
        "px-4 pb-4 transition-all duration-300",
        isCollapsed ? "max-h-0 opacity-0 p-0 overflow-hidden" : "max-h-none opacity-100"
      )}>
        {/* Search Input */}
        <div className="relative mb-4">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions, events, logs..."
            className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Searching...</span>
            </div>
          ) : results.length > 0 ? (
            results.map((result, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{result.title || result.name || result.fileName || 'Untitled'}</p>
                  <p className="text-xs text-gray-500 mt-1 truncate">{result.description || result.content || result.type || ''}</p>
                </div>
              </div>
            ))
          ) : debouncedQuery.length >= 3 ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <div className="text-center">
                <SearchIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No results found</p>
                <p className="text-xs mt-1">Try adjusting your search</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <p className="text-sm">Enter at least 3 characters to search</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
