import { Workout } from '../types';

interface SummaryProps {
  workouts: Workout[];
}

export function Summary({ workouts }: SummaryProps) {
  const totalWorkouts = workouts.length;
  const totalDuration = workouts.reduce((sum, w) => sum + w.duration, 0);
  const totalCalories = workouts.reduce((sum, w) => sum + w.calories, 0);

  return (
    <div className="summary">
      <div className="stat">
        <span className="stat-value">{totalWorkouts}</span>
        <span className="stat-label">Workouts</span>
      </div>
      <div className="stat">
        <span className="stat-value">{totalDuration}</span>
        <span className="stat-label">Total Minutes</span>
      </div>
      <div className="stat">
        <span className="stat-value">{totalCalories}</span>
        <span className="stat-label">Calories Burned</span>
      </div>
    </div>
  );
}
