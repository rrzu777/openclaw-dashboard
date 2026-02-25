"use client";

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'dashboard-sections';

interface UseCollapsibleOptions {
  sectionId: string;
  defaultCollapsed?: boolean;
}

export function useCollapsible({ 
  sectionId, 
  defaultCollapsed = false
}: UseCollapsibleOptions) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const sections = JSON.parse(stored);
        if (sections[sectionId] !== undefined) {
          setIsCollapsed(sections[sectionId]);
        }
      }
    } catch (e) {
      console.error('Failed to load collapsed state:', e);
    }
    setIsInitialized(true);
  }, [sectionId]);

  // Save to localStorage when state changes
  useEffect(() => {
    if (!isInitialized) return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const sections = stored ? JSON.parse(stored) : {};
      sections[sectionId] = isCollapsed;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
    } catch (e) {
      console.error('Failed to save collapsed state:', e);
    }
  }, [isCollapsed, sectionId, isInitialized]);

  // Listen for collapse-all / expand-all events
  useEffect(() => {
    const handleCollapseAll = () => setIsCollapsed(true);
    const handleExpandAll = () => setIsCollapsed(false);

    window.addEventListener('dashboard-collapse-all', handleCollapseAll);
    window.addEventListener('dashboard-expand-all', handleExpandAll);

    return () => {
      window.removeEventListener('dashboard-collapse-all', handleCollapseAll);
      window.removeEventListener('dashboard-expand-all', handleExpandAll);
    };
  }, []);

  const toggle = () => setIsCollapsed(prev => !prev);

  return { isCollapsed, toggle, setIsCollapsed };
}

// Helper functions for buttons (dispatch custom events)
export function collapseAllSections() {
  window.dispatchEvent(new CustomEvent('dashboard-collapse-all'));
}

export function expandAllSections() {
  window.dispatchEvent(new CustomEvent('dashboard-expand-all'));
}
