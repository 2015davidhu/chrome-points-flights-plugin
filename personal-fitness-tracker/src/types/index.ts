export interface Workout {
  id: string;
  date: string;
  type: WorkoutType;
  duration: number; // minutes
  calories: number;
  notes: string;
}

export type WorkoutType = 'running' | 'cycling' | 'swimming' | 'weights' | 'yoga' | 'other';

export interface DailySummary {
  date: string;
  totalWorkouts: number;
  totalDuration: number;
  totalCalories: number;
}
