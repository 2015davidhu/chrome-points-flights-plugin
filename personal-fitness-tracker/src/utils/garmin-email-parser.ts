/**
 * Creative Garmin data ingestion: parse Garmin daily summary emails.
 *
 * Garmin sends daily summary emails with stats like steps, calories,
 * distance, active minutes, and workout summaries. This parser extracts
 * structured data from those email bodies.
 *
 * Usage: Forward Garmin emails to a webhook (e.g., via Mailgun, SendGrid
 * inbound parse, or a Gmail Apps Script) that POSTs the email body here.
 */

import { Workout, WorkoutType } from '../types';
import { generateId } from './storage';

interface GarminEmailData {
  date: string;
  steps: number;
  totalDistance: number; // km
  activeMinutes: number;
  calories: number;
  workouts: Workout[];
}

const WORKOUT_PATTERNS: Record<string, WorkoutType> = {
  'running': 'running',
  'run': 'running',
  'cycling': 'cycling',
  'biking': 'cycling',
  'ride': 'cycling',
  'swimming': 'swimming',
  'swim': 'swimming',
  'strength': 'weights',
  'weight': 'weights',
  'yoga': 'yoga',
};

function detectWorkoutType(text: string): WorkoutType {
  const lower = text.toLowerCase();
  for (const [keyword, type] of Object.entries(WORKOUT_PATTERNS)) {
    if (lower.includes(keyword)) return type;
  }
  return 'other';
}

export function parseGarminEmail(emailBody: string): GarminEmailData {
  const lines = emailBody.split('\n').map(l => l.trim()).filter(Boolean);

  // Extract date from common Garmin email format: "Daily Summary for March 28, 2026"
  const dateMatch = emailBody.match(/(?:summary\s+for|date[:\s]+)([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  const date = dateMatch ? new Date(dateMatch[1]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  // Extract numeric stats using flexible pattern matching
  const steps = extractNumber(emailBody, /(\d[\d,]*)\s*steps/i);
  const totalDistance = extractNumber(emailBody, /([\d.]+)\s*(?:km|mi|miles)/i);
  const activeMinutes = extractNumber(emailBody, /(\d+)\s*(?:active\s*min|minutes?\s*active)/i);
  const calories = extractNumber(emailBody, /([\d,]+)\s*(?:calories|cal|kcal)\s*(?:burned)?/i);

  // Extract individual workout blocks
  const workouts: Workout[] = [];
  const workoutBlockRegex = /(?:activity|workout)[:\s]*([^\n]+)\n([\s\S]*?)(?=(?:activity|workout)[:\s]|$)/gi;
  let match;

  while ((match = workoutBlockRegex.exec(emailBody)) !== null) {
    const title = match[1];
    const block = match[2];
    const duration = extractNumber(block, /(\d+)\s*(?:min|minutes)/i);
    const workoutCal = extractNumber(block, /([\d,]+)\s*(?:cal|kcal)/i);

    workouts.push({
      id: generateId(),
      date,
      type: detectWorkoutType(title),
      duration: duration || 0,
      calories: workoutCal || 0,
      notes: `Imported from Garmin email: ${title.trim()}`,
    });
  }

  // If no structured blocks found but we detect activity keywords, create a single workout
  if (workouts.length === 0 && activeMinutes > 0) {
    const type = detectWorkoutType(emailBody);
    if (type !== 'other' || emailBody.toLowerCase().includes('workout')) {
      workouts.push({
        id: generateId(),
        date,
        type,
        duration: activeMinutes,
        calories: calories || 0,
        notes: 'Auto-parsed from Garmin daily email',
      });
    }
  }

  return { date, steps, totalDistance, activeMinutes, calories, workouts };
}

function extractNumber(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  if (!match) return 0;
  return parseFloat(match[1].replace(/,/g, ''));
}

/**
 * Folder watcher approach: parse .FIT files dropped into a sync directory.
 * Garmin Express syncs .FIT files to ~/Garmin/ on desktop.
 * A Node.js backend can watch that folder and parse new files.
 *
 * This is a stub for the frontend — the actual watcher would run server-side:
 *
 *   import chokidar from 'chokidar';
 *   import FitParser from 'fit-file-parser';
 *
 *   chokidar.watch('~/Garmin/Activities/*.fit').on('add', (path) => {
 *     const parser = new FitParser();
 *     parser.parse(fs.readFileSync(path), (err, data) => {
 *       // data.activity.sessions[0] has all the run data
 *       // POST it to your API
 *     });
 *   });
 */
export type { GarminEmailData };
