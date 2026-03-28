import { useState, useCallback } from 'react';
import { WorkoutForm } from './components/WorkoutForm';
import { WorkoutList } from './components/WorkoutList';
import { Summary } from './components/Summary';
import { TrainingPlanGenerator } from './components/TrainingPlanGenerator';
import { GarminImport } from './components/GarminImport';
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
      <GarminImport onImport={refresh} />
      <WorkoutForm onSave={refresh} />
      <TrainingPlanGenerator workouts={workouts} />
      <WorkoutList workouts={workouts} onDelete={refresh} />
    </div>
  );
}
