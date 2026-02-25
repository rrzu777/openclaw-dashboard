"use client";

import { useState, useEffect } from 'react';
import { Search as SearchIcon, FileText, Loader2, X } from 'lucide-react';
// Manual debounce is easier than installing a package for just one component.

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Manual debounce effect
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
    <div className="flex flex-col space-y-4 w-full p-4 bg-white rounded-lg shadow-sm border">
      <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
        <SearchIcon className="w-5 h-5 text-gray-600" />
        Global Search
      </h2>
      
      <div className="relative">
        <input
          type="text"
          placeholder="Search memories (min 3 chars)..."
          className="w-full p-2 pl-9 rounded border bg-gray-50 focus:bg-white focus:ring-2 ring-blue-500 outline-none text-sm transition-all"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
        {loading && (
          <Loader2 className="w-4 h-4 text-blue-500 absolute right-3 top-3 animate-spin" />
        )}
        {query && !loading && (
          <button 
            onClick={() => { setQuery(''); setResults([]); }}
            className="absolute right-2 top-2 p-1 hover:bg-gray-200 rounded-full"
          >
            <X className="w-3 h-3 text-gray-500" />
          </button>
        )}
      </div>

      {/* Results Area */}
      {results.length > 0 && (
        <div className="space-y-2 mt-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
          {results.map((result) => (
            <div 
              key={result.id} 
              className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 text-sm border-b last:border-0 border-gray-100 transition-colors cursor-default"
            >
              <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-semibold text-gray-700 truncate">{result.fileName}</span>
                  <span className="text-xs text-gray-400 font-mono">L{result.lineNum}</span>
                </div>
                <p className="text-gray-600 text-xs truncate font-mono bg-yellow-50/50 px-1 rounded">
                  {result.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {debouncedQuery.length >= 3 && !loading && results.length === 0 && (
        <div className="text-center text-gray-400 text-xs py-4 italic">
          No matches found in memory.
        </div>
      )}
    </div>
  );
}
