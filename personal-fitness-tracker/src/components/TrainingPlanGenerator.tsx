import { useState } from 'react';
import { Workout } from '../types';
import {
  GANModel,
  GeneratedPlan,
  createGAN,
  trainGAN,
  generateTrainingPlan,
} from '../utils/gan-training-generator';

interface TrainingPlanGeneratorProps {
  workouts: Workout[];
}

export function TrainingPlanGenerator({ workouts }: TrainingPlanGeneratorProps) {
  const [model, setModel] = useState<GANModel | null>(null);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [training, setTraining] = useState(false);
  const [trained, setTrained] = useState(false);

  const handleTrain = () => {
    setTraining(true);
    // Use setTimeout to let the UI update before the sync computation
    setTimeout(() => {
      const gan = createGAN();
      trainGAN(gan, workouts, 500);
      setModel(gan);
      setTrained(true);
      setTraining(false);
    }, 50);
  };

  const handleGenerate = () => {
    if (!model) return;
    setPlan(generateTrainingPlan(model));
  };

  return (
    <div className="training-plan">
      <h2>AI Training Plan Generator</h2>
      <p className="plan-description">
        Uses a GAN (Generative Adversarial Network) trained on your workout history
        to generate personalized weekly training plans that match your patterns.
      </p>

      {workouts.length < 3 ? (
        <p className="plan-warning">
          Log at least 3 workouts to train the AI. The more data, the better the plans.
        </p>
      ) : (
        <>
          <div className="plan-actions">
            <button onClick={handleTrain} disabled={training}>
              {training ? 'Training GAN...' : trained ? 'Retrain GAN' : 'Train GAN on My Data'}
            </button>
            {trained && (
              <button onClick={handleGenerate}>
                Generate New Plan
              </button>
            )}
          </div>

          {trained && model && (
            <div className="plan-stats">
              <small>
                Epoch: {model.stats.epoch} |
                D-Loss: {model.stats.discLoss.toFixed(3)} |
                G-Loss: {model.stats.genLoss.toFixed(3)}
              </small>
            </div>
          )}
        </>
      )}

      {plan && (
        <div className="plan-grid">
          {plan.days.map((day) => (
            <div
              key={day.dayOfWeek}
              className={`plan-day ${day.isRestDay ? 'rest-day' : ''}`}
            >
              <strong>{day.dayOfWeek}</strong>
              {day.isRestDay ? (
                <span className="rest-label">Rest Day</span>
              ) : (
                <>
                  <span className="plan-type">{day.type}</span>
                  <span>{day.duration} min</span>
                  <span>{day.calories} cal</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
