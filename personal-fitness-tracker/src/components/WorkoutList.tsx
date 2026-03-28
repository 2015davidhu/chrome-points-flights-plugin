import { Workout } from '../types';
import { deleteWorkout } from '../utils/storage';

interface WorkoutListProps {
  workouts: Workout[];
  onDelete: () => void;
}

export function WorkoutList({ workouts, onDelete }: WorkoutListProps) {
  const handleDelete = (id: string) => {
    deleteWorkout(id);
    onDelete();
  };

  if (workouts.length === 0) {
    return <p className="empty">No workouts logged yet. Start by adding one above!</p>;
  }

  return (
    <div className="workout-list">
      <h2>Workout History</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Duration</th>
            <th>Calories</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {workouts.map(w => (
            <tr key={w.id}>
              <td>{w.date}</td>
              <td>{w.type}</td>
              <td>{w.duration} min</td>
              <td>{w.calories}</td>
              <td>{w.notes}</td>
              <td><button onClick={() => handleDelete(w.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
