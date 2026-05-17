"use client";

import { useState, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, Repeat, ChevronRight, ChevronDown, ChevronLeft } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, parseISO, startOfDay, isWithinInterval } from 'date-fns';
import { clsx } from 'clsx';
import { CronExpressionParser } from 'cron-parser';
import type { CronJob } from '../lib/types';
import { API_ROUTES } from '../lib/config';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface ProjectedSlot {
  job: CronJob;
  date: Date;
  time: string;
}

function getScheduleIntervalHours(schedule: string): number | null {
  const everyMatch = schedule.match(/Every\s+(\d+)\s*(min|h|hour|hours)/i);
  if (!everyMatch) return null;
  const value = parseInt(everyMatch[1], 10);
  const unit = everyMatch[2].toLowerCase();
  if (unit === 'min') return value / 60;
  if (unit.startsWith('h')) return value;
  return null;
}

function projectRecurringJobs(jobs: CronJob[], weekStart: Date, weekEnd: Date): ProjectedSlot[] {
  const slots: ProjectedSlot[] = [];
  const now = new Date();

  jobs.forEach(job => {
    if (job.status === 'disabled') return;
    // Skip every-minute jobs (noise in calendar view)
    if (job.schedule === '* * * * *') return;

    // Try "Every X min/h" format first
    const intervalHours = getScheduleIntervalHours(job.schedule);
    if (intervalHours && intervalHours > 0) {
      const intervalMs = intervalHours * 60 * 60 * 1000;
      let cursor = new Date(job.nextRun || now);
      if (cursor < weekStart) {
        const steps = Math.ceil((weekStart.getTime() - cursor.getTime()) / intervalMs);
        cursor = new Date(cursor.getTime() + steps * intervalMs);
      }
      while (cursor <= weekEnd) {
        if (cursor >= now) {
          slots.push({ job, date: new Date(cursor), time: format(cursor, 'HH:mm') });
        }
        cursor = new Date(cursor.getTime() + intervalMs);
      }
      return;
    }

    // Try cron expression (5-part POSIX cron like "0 */2 * * *")
    // Only works if schedule looks like a cron expression (has spaces and numbers/stars)
    if (/^[\d*\/,\-\s]+$/.test(job.schedule) && job.schedule.trim().split(/\s+/).length >= 5) {
      try {
        const interval = CronExpressionParser.parse(job.schedule, {
          currentDate: weekStart,
          endDate: weekEnd,
        });
        while (true) {
          let d: Date;
          try { d = interval.next().toDate(); } catch { break; }
          if (d > weekEnd) break;
          if (d >= now) {
            slots.push({ job, date: d, time: format(d, 'HH:mm') });
          }
        }
      } catch {
        // Not a valid cron expression, skip
      }
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
          setJobs(data.jobs || []);
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

  const nextUp = useMemo(() => {
    const all: { job: CronJob; date: Date; time: string }[] = [];
    const now = new Date();

    jobs.forEach(job => {
      if (job.nextRun && !job.schedule.toLowerCase().includes('every')) {
        all.push({ job, date: parseISO(job.nextRun), time: format(parseISO(job.nextRun), 'HH:mm') });
      }
    });

    all.push(...projectedSlots);

    return all
      .filter(s => s.date >= now)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5);
  }, [jobs, projectedSlots]);

  const getSlotsForDay = (day: Date) => {
    const dayStart = startOfDay(day);
    const dayEnd = addDays(dayStart, 1);
    return projectedSlots.filter(s => isWithinInterval(s.date, { start: dayStart, end: dayEnd }));
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => addDays(prev, direction === 'prev' ? -7 : 7));
  };

  const isToday = (date: Date) => isSameDay(date, new Date());

  const getJobDisplayName = (job: CronJob) => {
    if (job.name !== 'System Task') return job.name;
    // Extract script name from command
    if (job.command) {
      const parts = job.command.split('/');
      const script = parts[parts.length - 1]?.split(' ')[0];
      if (script) return script.replace(/\.(sh|py|js)$/, '');
    }
    return job.name;
  };

  return (
    <Card padding="none" className="h-full flex flex-col">
      {/* Header */}
      <SectionHeader
        title="Weekly Schedule"
        description="Upcoming cron jobs"
        icon={<CalendarIcon className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigateWeek('prev'); }}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigateWeek('next'); }}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggle(); }}>
              <ChevronDown className={clsx("w-4 h-4 transition-transform", isCollapsed && "-rotate-90")} />
            </Button>
          </div>
        }
        className="px-4 py-3"
      />
      
      {/* Content */}
      <CardContent className={clsx(
        "transition-all duration-300",
        isCollapsed ? "max-h-0 opacity-0 p-0 overflow-hidden" : "max-h-none opacity-100"
      )}>
        {/* Next Up Section */}
        <div className="mb-4 pb-3 border-b border-gray-200">
          <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Next Up
          </h4>
          <div className="space-y-1.5">
            {nextUp.length > 0 ? (
              nextUp.map((item, idx) => (
                <div
                  key={`${item.job.id}-${idx}`}
                  className="flex items-center gap-2 text-xs p-2 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => setSelectedJob(item.job)}
                >
                  <span className="font-mono text-gray-600 w-11 shrink-0">{item.time}</span>
                  <span className="font-medium text-gray-900 truncate flex-1">{getJobDisplayName(item.job)}</span>
                  <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 italic">No upcoming jobs</p>
            )}
          </div>
        </div>

        {/* Weekly Grid */}
        <div className="mb-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div key={day.toString()} className="text-center">
                <div className="text-[10px] font-medium text-gray-500 uppercase mb-1">
                  {format(day, 'EEE')}
                </div>
                <div className={clsx(
                  "text-sm font-bold py-1.5 rounded",
                  isToday(day) 
                    ? "bg-blue-600 text-white" 
                    : "text-gray-700 hover:bg-gray-100"
                )}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 h-48">
            {weekDays.map((day) => {
              const daySlots = getSlotsForDay(day);
              const today = isToday(day);
              
              return (
                <div
                  key={day.toString()}
                  className={clsx(
                    "flex flex-col gap-1 rounded-md p-1.5 border min-h-0 overflow-hidden transition-colors",
                    today 
                      ? "bg-blue-50/50 border-blue-200" 
                      : "bg-gray-50/50 border-gray-200 hover:bg-gray-100"
                  )}
                >
                  <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar flex-1">
                    {daySlots.map((slot, idx) => (
                      <div
                        key={`${slot.job.id}-${idx}`}
                        onClick={() => setSelectedJob(slot.job)}
                        className={clsx(
                          "p-1.5 rounded border shadow-sm flex flex-col gap-0.5 cursor-pointer transition-all hover:scale-105 hover:z-10",
                          "bg-blue-100 border-blue-200 text-blue-900"
                        )}
                      >
                        <span className="font-semibold text-[10px] truncate leading-tight">
                          {getJobDisplayName(slot.job)}
                        </span>
                        <span className="flex items-center gap-0.5 opacity-75 text-[9px]">
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

        {/* Recurring Jobs Legend */}
        {jobs.filter(j => j.schedule.toLowerCase().includes('every') && j.status === 'active' && j.schedule !== '* * * * *').length > 0 && (
          <div className="pt-3 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5" />
              Recurring Jobs
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {jobs
                .filter(j => j.schedule.toLowerCase().includes('every') && j.status === 'active' && j.schedule !== '* * * * *')
                .slice(0, 5)
                .map(job => (
                  <Badge key={job.id} variant="info" size="sm">
                    {job.name}
                  </Badge>
                ))}
              {jobs.filter(j => j.schedule.toLowerCase().includes('every') && j.status === 'active' && j.schedule !== '* * * * *').length > 5 && (
                <Badge variant="default" size="sm">+more</Badge>
              )}
            </div>
          </div>
        )}

        {/* Selected Job Modal */}
        {selectedJob && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-base font-semibold text-gray-900">{selectedJob.name}</h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedJob(null)}>
                  <ChevronDown className="w-4 h-4 rotate-90" />
                </Button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Schedule</p>
                  <p className="text-sm font-medium text-gray-900">{selectedJob.schedule}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <Badge variant={selectedJob.status === 'active' ? 'success' : 'default'} size="sm" dot>
                    {selectedJob.status}
                  </Badge>
                </div>
                {selectedJob.nextRun && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Next Run</p>
                    <p className="text-sm font-medium text-gray-900">
                      {format(parseISO(selectedJob.nextRun), 'PPP p')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
