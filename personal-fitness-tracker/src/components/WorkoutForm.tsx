import { useState } from 'react';
import { WorkoutType } from '../types';
import { saveWorkout, generateId } from '../utils/storage';

const WORKOUT_TYPES: WorkoutType[] = ['running', 'cycling', 'swimming', 'weights', 'yoga', 'other'];

interface WorkoutFormProps {
  onSave: () => void;
}

export function WorkoutForm({ onSave }: WorkoutFormProps) {
  const [type, setType] = useState<WorkoutType>('running');
  const [duration, setDuration] = useState('');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveWorkout({
      id: generateId(),
      date: new Date().toISOString().split('T')[0],
      type,
      duration: Number(duration),
      calories: Number(calories),
      notes,
    });
    setDuration('');
    setCalories('');
    setNotes('');
    onSave();
  };

  return (
    <form onSubmit={handleSubmit} className="workout-form">
      <h2>Log Workout</h2>
      <label>
        Type
        <select value={type} onChange={e => setType(e.target.value as WorkoutType)}>
          {WORKOUT_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Duration (min)
        <input type="number" value={duration} onChange={e => setDuration(e.target.value)} required min="1" />
      </label>
      <label>
        Calories
        <input type="number" value={calories} onChange={e => setCalories(e.target.value)} required min="0" />
      </label>
      <label>
        Notes
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} />
      </label>
      <button type="submit">Save Workout</button>
    </form>
  );
}
