"use client";

import { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, Repeat, Terminal, X, ChevronRight, ChevronDown } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, parseISO, startOfDay, isWithinInterval } from 'date-fns';
import { clsx } from 'clsx';
import type { CronJob } from '../lib/types';
import { API_ROUTES } from '../lib/config';
import { useCollapsible } from '@/lib/hooks/useCollapsible';

interface ProjectedSlot {
  job: CronJob;
  date: Date;
  time: string;
}

// Parse schedule to get interval in hours (for "Every X min/h" formats)
function getScheduleIntervalHours(schedule: string): number | null {
  const everyMatch = schedule.match(/Every\s+(\d+)\s*(min|h|hour|hours)/i);
  if (!everyMatch) return null;
  const value = parseInt(everyMatch[1], 10);
  const unit = everyMatch[2].toLowerCase();
  if (unit === 'min') return value / 60;
  if (unit.startsWith('h')) return value;
  return null;
}

// Project recurring jobs across the week
function projectRecurringJobs(jobs: CronJob[], weekStart: Date, weekEnd: Date): ProjectedSlot[] {
  const slots: ProjectedSlot[] = [];
  const now = new Date();

  jobs.forEach(job => {
    if (!job.schedule.toLowerCase().includes('every')) return;
    
    const intervalHours = getScheduleIntervalHours(job.schedule);
    if (!intervalHours || intervalHours <= 0) return;

    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    // Find first occurrence in the week
    let cursor = new Date(job.nextRun || now);
    if (cursor < weekStart) {
      // Advance cursor to be within the week
      const diffMs = weekStart.getTime() - cursor.getTime();
      const steps = Math.ceil(diffMs / intervalMs);
      cursor = new Date(cursor.getTime() + steps * intervalMs);
    }

    // Generate slots for the entire week
    while (cursor <= weekEnd) {
      if (cursor >= now) {
        slots.push({
          job,
          date: cursor,
          time: format(cursor, 'HH:mm'),
        });
      }
      cursor = new Date(cursor.getTime() + intervalMs);
    }
  });

  return slots.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export default function Calendar() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [projectedSlots, setProjectedSlots] = useState<ProjectedSlot[]>([]);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'calendar', defaultCollapsed: false });

  const weekEnd = useMemo(() => addDays(currentWeekStart, 6), [currentWeekStart]);
  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i)), [currentWeekStart]);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch(API_ROUTES.cron);
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs);
        }
      } catch (err) {
        console.error('Failed to fetch cron:', err);
      }
    };
    fetchJobs();
  }, []);

  useEffect(() => {
    const slots = projectRecurringJobs(jobs, currentWeekStart, weekEnd);
    setProjectedSlots(slots);
  }, [jobs, currentWeekStart, weekEnd]);

  // Next up: upcoming 5 events (mix of nextRun and projected)
  const nextUp = (() => {
    const all: { job: CronJob; date: Date; time: string }[] = [];
    const now = new Date();

    // Add single-run jobs (nextRun only)
    jobs.forEach(job => {
      if (job.nextRun && !job.schedule.toLowerCase().includes('every')) {
        all.push({ job, date: parseISO(job.nextRun), time: format(parseISO(job.nextRun), 'HH:mm') });
      }
    });

    // Add projected recurring jobs
    all.push(...projectedSlots);

    // Filter future, sort, take 5
    return all
      .filter(s => s.date >= now)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5);
  })();

  // Get slots for a specific day
  const getSlotsForDay = (day: Date) => {
    const dayStart = startOfDay(day);
    const dayEnd = addDays(dayStart, 1);
    return projectedSlots.filter(s => isWithinInterval(s.date, { start: dayStart, end: dayEnd }));
  };

  return (
    <div className="flex flex-col space-y-3 w-full h-full overflow-hidden">
      {/* Header */}
      <button 
        onClick={toggle}
        className="flex justify-between items-center px-4 py-3 hover:bg-gray-50 transition-colors shrink-0 rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-purple-600" />
            Weekly Schedule
          </h2>
          <div className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">
            {format(currentWeekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}
          </div>
        </div>
        <ChevronDown 
          className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} 
        />
      </button>

      {/* Next Up Queue */}
      <div 
        className={`shrink-0 px-4 overflow-hidden transition-all duration-300 ease-in-out ${
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-40 opacity-100'
        }`}
      >
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
          <Clock className="w-3 h-3" /> Next Up
        </h3>
        <div className="space-y-1">
          {nextUp.map((item, idx) => (
            <div
              key={`${item.job.id}-${idx}`}
              className="flex items-center gap-2 text-xs p-1.5 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 cursor-pointer"
              onClick={() => setSelectedJob(item.job)}
            >
              <span className="font-mono text-gray-500 w-10 shrink-0">{item.time}</span>
              <span className="font-medium truncate flex-1">{item.job.name}</span>
              <ChevronRight className="w-3 h-3 text-gray-400" />
            </div>
          ))}
          {nextUp.length === 0 && (
            <div className="text-xs text-gray-400 italic p-1.5">No upcoming jobs</div>
          )}
        </div>
      </div>
      
      {/* Calendar Grid */}
      <div 
        className={`flex-1 min-h-0 overflow-hidden px-4 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'
        }`}
      >
        <div className="grid grid-cols-7 gap-1 h-full">
          {weekDays.map((day) => {
            const daySlots = getSlotsForDay(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div
                key={day.toString()}
                className={clsx(
                  "flex flex-col gap-1 rounded p-1 border min-h-0 overflow-hidden",
                  isToday ? "bg-blue-50/50 border-blue-200" : "bg-gray-50/50 border-gray-100"
                )}
              >
                <div className="text-center pb-1 shrink-0">
                  <div className="text-[9px] font-bold text-gray-400 uppercase">{format(day, 'EEE')}</div>
                  <div className={clsx("text-xs font-bold", isToday ? "text-blue-600" : "text-gray-600")}>
                    {format(day, 'd')}
                  </div>
                </div>
                
                <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar min-h-0 flex-1">
                  {daySlots.map((slot, idx) => (
                    <div
                      key={`${slot.job.id}-${idx}`}
                      onClick={() => setSelectedJob(slot.job)}
                      className={clsx(
                        "p-1.5 rounded text-[9px] border shadow-sm flex flex-col gap-0.5 cursor-pointer transition-all hover:scale-105 hover:z-10",
                        "bg-purple-100 border-purple-200 text-purple-900"
                      )}
                    >
                      <span className="font-semibold truncate leading-tight">{slot.job.name}</span>
                      <span className="flex items-center gap-0.5 opacity-75 text-[8px]">
                        <Clock className="w-2 h-2" />
                        {slot.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Legend */}
      <div 
        className={`shrink-0 p-2 bg-gray-900 text-gray-100 rounded-lg mx-4 mb-4 overflow-hidden transition-all duration-300 ease-in-out ${
          isCollapsed ? 'max-h-0 opacity-0 p-0' : 'max-h-32 opacity-100'
        }`}
      >
        <h3 className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-2">
          <Terminal className="w-3 h-3" /> Recurring Jobs
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {jobs.filter(j => j.schedule.toLowerCase().includes('every') && j.status === 'active').slice(0, 5).map(job => (
            <span
              key={job.id}
              onClick={() => setSelectedJob(job)}
              className="text-[9px] bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded flex items-center gap-1.5 cursor-pointer hover:bg-gray-700"
            >
              <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></span>
              {job.name}
            </span>
          ))}
        </div>
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedJob(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-bold text-gray-900">{selectedJob.name}</h3>
              <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <Repeat className="w-4 h-4 text-purple-600" />
                <div>
                  <div className="text-xs text-gray-500">Schedule</div>
                  <div className="font-mono font-medium">{selectedJob.schedule}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <Clock className="w-4 h-4 text-blue-600" />
                <div>
                  <div className="text-xs text-gray-500">Next Run</div>
                  <div className="font-medium">{selectedJob.nextRun ? format(parseISO(selectedJob.nextRun), 'PPpp') : 'N/A'}</div>
                </div>
              </div>
              
              {selectedJob.lastRun && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <Terminal className="w-4 h-4 text-green-600" />
                  <div>
                    <div className="text-xs text-gray-500">Last Run</div>
                    <div className="font-medium">{format(parseISO(selectedJob.lastRun), 'PPpp')}</div>
                  </div>
                </div>
              )}
              
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-500 mb-1">Command / Payload</div>
                <div className="font-mono text-xs bg-white p-2 rounded border break-all">{selectedJob.command}</div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Status:</span>
                <span className={clsx(
                  "px-2 py-0.5 rounded text-xs font-medium",
                  selectedJob.status === 'active' ? "bg-green-100 text-green-700" :
                  selectedJob.status === 'disabled' ? "bg-gray-100 text-gray-600" :
                  "bg-blue-100 text-blue-700"
                )}>
                  {selectedJob.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
