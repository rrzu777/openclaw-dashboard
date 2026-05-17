import fs from 'fs/promises';
import { CronExpressionParser } from 'cron-parser';
import { CronJob } from './types';
import { JOBS_FILE, SYSTEM_CRON_FILE } from './constants';

export async function getCronJobs(): Promise<CronJob[]> {
  const jobs: CronJob[] = [];

  // 1. OpenClaw Jobs
  try {
    const data = await fs.readFile(JOBS_FILE, 'utf-8');
    const json = JSON.parse(data);
    
    // Check if jobs is array (v1 format: { jobs: [...] })
    const jobList = Array.isArray(json.jobs) ? json.jobs : [];

    jobList.forEach((job: any) => {
      let scheduleText = 'Unknown';
      if (job.schedule?.kind === 'every') {
        const mins = Math.round(job.schedule.everyMs / 60000);
        scheduleText = `Every ${mins} min`;
      } else if (job.schedule?.kind === 'cron') {
        scheduleText = job.schedule.expr;
      }

      jobs.push({
        id: job.id,
        name: job.name || 'Unnamed Task',
        schedule: scheduleText,
        nextRun: job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs).toISOString() : null,
        lastRun: job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs).toISOString() : null,
        status: job.enabled ? 'active' : 'disabled',
        command: job.payload?.message || job.payload?.kind || 'Unknown payload'
      });
    });
  } catch (err) {
    console.error("Error reading OpenClaw jobs:", err);
  }

  // 2. System Cron Jobs
  try {
    const content = await fs.readFile(SYSTEM_CRON_FILE, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      // Basic cron line parsing: 5 parts + command
      // simplified regex or split
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 6) {
        const schedule = parts.slice(0, 5).join(' ');
        const command = parts.slice(5).join(' ');
        
        let nextRun = null;
        try {
          // Validate and parse schedule
          const interval = CronExpressionParser.parse(schedule);
          nextRun = interval.next().toISOString();
        } catch (e) {
          // Invalid schedule, ignore nextRun
        }

        jobs.push({
          id: `sys-${idx}`,
          name: 'System Task',
          schedule,
          nextRun,
          lastRun: null, // System cron doesn't track history here
          status: 'system',
          command
        });
      }
    });
  } catch (err) {
    // File might not exist or permission denied
    // console.warn("System cron not readable:", err);
  }

  // Sort by next run (earliest first)
  return jobs.sort((a, b) => {
    if (!a.nextRun) return 1;
    if (!b.nextRun) return -1;
    return new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime();
  });
}
