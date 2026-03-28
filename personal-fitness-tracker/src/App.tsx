import { useState, useCallback } from 'react';
import { WorkoutForm } from './components/WorkoutForm';
import { WorkoutList } from './components/WorkoutList';
import { Summary } from './components/Summary';
import { getWorkouts } from './utils/storage';
import './App.css';

export default function App() {
  const [workouts, setWorkouts] = useState(getWorkouts());

  const refresh = useCallback(() => {
    setWorkouts(getWorkouts());
  }, []);

  return (
    <div className="app">
      <h1>Fitness Tracker</h1>
      <Summary workouts={workouts} />
      <WorkoutForm onSave={refresh} />
      <WorkoutList workouts={workouts} onDelete={refresh} />
    </div>
  );
}
