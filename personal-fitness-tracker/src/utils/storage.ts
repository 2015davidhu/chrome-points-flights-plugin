import { Workout } from '../types';

const STORAGE_KEY = 'fitness-tracker-workouts';

export function getWorkouts(): Workout[] {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveWorkout(workout: Workout): void {
  const workouts = getWorkouts();
  workouts.push(workout);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
}

export function deleteWorkout(id: string): void {
  const workouts = getWorkouts().filter(w => w.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
}

export function generateId(): string {
  return crypto.randomUUID();
}
