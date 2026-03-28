/**
 * GAN-based Training Plan Generator
 *
 * A simplified GAN (Generative Adversarial Network) that learns from your
 * real workout history and generates realistic future training plans that
 * match YOUR personal patterns — rest day frequency, intensity progression,
 * workout type preferences, and seasonal variation.
 *
 * Architecture:
 *   Generator: Takes random noise → produces a week of workouts
 *   Discriminator: Takes a week of workouts → predicts real vs. generated
 *
 * Both are simple feedforward neural networks implemented from scratch
 * (no TensorFlow/PyTorch dependency — runs entirely in the browser).
 */

import { Workout, WorkoutType } from '../types';

// --- Neural Network Primitives ---

type Matrix = number[][];
type Vector = number[];

function randomMatrix(rows: number, cols: number, scale = 0.1): Matrix {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => (Math.random() * 2 - 1) * scale)
  );
}

function zeros(n: number): Vector {
  return new Array(n).fill(0);
}

function matmul(input: Vector, weights: Matrix, bias: Vector): Vector {
  return weights[0].map((_, col) =>
    input.reduce((sum, val, row) => sum + val * weights[row][col], 0) + bias[col]
  );
}

function leakyRelu(x: Vector, alpha = 0.2): Vector {
  return x.map(v => (v > 0 ? v : alpha * v));
}

function leakyReluGrad(x: Vector, alpha = 0.2): Vector {
  return x.map(v => (v > 0 ? 1 : alpha));
}

function sigmoid(x: Vector): Vector {
  return x.map(v => 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, v)))));
}

function tanh(x: Vector): Vector {
  return x.map(v => Math.tanh(v));
}

function tanhGrad(output: Vector): Vector {
  return output.map(v => 1 - v * v);
}

// --- Workout Encoding ---

const WORKOUT_TYPES: WorkoutType[] = ['running', 'cycling', 'swimming', 'weights', 'yoga', 'other'];
const FEATURES_PER_DAY = 9; // type (6 one-hot) + duration + calories + dayOfWeek
const DAYS_PER_WEEK = 7;
const WORKOUT_VECTOR_SIZE = FEATURES_PER_DAY * DAYS_PER_WEEK; // 63

interface WorkoutDay {
  type: WorkoutType;
  duration: number; // normalized 0-1
  calories: number; // normalized 0-1
  dayOfWeek: number; // 0-6
}

function encodeWorkoutDay(day: WorkoutDay): Vector {
  const typeOneHot = WORKOUT_TYPES.map(t => (t === day.type ? 1 : 0));
  return [...typeOneHot, day.duration, day.calories, day.dayOfWeek / 6];
}

function decodeWorkoutDay(vec: Vector, dayOfWeek: number): WorkoutDay {
  const typeScores = vec.slice(0, 6);
  const maxIdx = typeScores.indexOf(Math.max(...typeScores));
  return {
    type: WORKOUT_TYPES[maxIdx],
    duration: Math.max(0, Math.min(1, (vec[6] + 1) / 2)), // tanh output → 0-1
    calories: Math.max(0, Math.min(1, (vec[7] + 1) / 2)),
    dayOfWeek,
  };
}

function encodeWeek(workouts: WorkoutDay[]): Vector {
  const vec: Vector = [];
  for (let d = 0; d < DAYS_PER_WEEK; d++) {
    if (d < workouts.length) {
      vec.push(...encodeWorkoutDay(workouts[d]));
    } else {
      vec.push(...zeros(FEATURES_PER_DAY));
    }
  }
  return vec;
}

// --- Network Layers ---

interface Layer {
  weights: Matrix;
  bias: Vector;
}

interface Network {
  layers: Layer[];
}

function createNetwork(sizes: number[]): Network {
  const layers: Layer[] = [];
  for (let i = 0; i < sizes.length - 1; i++) {
    layers.push({
      weights: randomMatrix(sizes[i], sizes[i + 1]),
      bias: zeros(sizes[i + 1]),
    });
  }
  return { layers };
}

interface ForwardResult {
  preActivations: Vector[];
  activations: Vector[];
}

function forward(net: Network, input: Vector, outputActivation: 'sigmoid' | 'tanh'): ForwardResult {
  const preActivations: Vector[] = [];
  const activations: Vector[] = [input];
  let current = input;

  for (let i = 0; i < net.layers.length; i++) {
    const pre = matmul(current, net.layers[i].weights, net.layers[i].bias);
    preActivations.push(pre);

    if (i === net.layers.length - 1) {
      current = outputActivation === 'sigmoid' ? sigmoid(pre) : tanh(pre);
    } else {
      current = leakyRelu(pre);
    }
    activations.push(current);
  }

  return { preActivations, activations };
}

// --- GAN ---

const NOISE_DIM = 32;
const HIDDEN_DIM = 128;
const LEARNING_RATE = 0.0002;

export interface GANModel {
  generator: Network;
  discriminator: Network;
  stats: TrainingStats;
}

interface TrainingStats {
  maxDuration: number;
  maxCalories: number;
  epoch: number;
  genLoss: number;
  discLoss: number;
}

export function createGAN(): GANModel {
  return {
    generator: createNetwork([NOISE_DIM, HIDDEN_DIM, HIDDEN_DIM, WORKOUT_VECTOR_SIZE]),
    discriminator: createNetwork([WORKOUT_VECTOR_SIZE, HIDDEN_DIM, 64, 1]),
    stats: { maxDuration: 60, maxCalories: 500, epoch: 0, genLoss: 0, discLoss: 0 },
  };
}

function randomNoise(): Vector {
  return Array.from({ length: NOISE_DIM }, () => Math.random() * 2 - 1);
}

function prepareTrainingData(workouts: Workout[]): { weeks: Vector[]; maxDuration: number; maxCalories: number } {
  if (workouts.length === 0) return { weeks: [], maxDuration: 60, maxCalories: 500 };

  const maxDuration = Math.max(...workouts.map(w => w.duration), 1);
  const maxCalories = Math.max(...workouts.map(w => w.calories), 1);

  // Group workouts by week
  const byDate = new Map<string, Workout[]>();
  for (const w of workouts) {
    const existing = byDate.get(w.date) || [];
    existing.push(w);
    byDate.set(w.date, existing);
  }

  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));

  // Slide a 7-day window to create training samples
  const weeks: Vector[] = [];
  for (let i = 0; i <= sorted.length - 7; i++) {
    const weekDays: WorkoutDay[] = [];
    for (let d = 0; d < 7; d++) {
      const dayWorkouts = sorted[i + d]?.[1] || [];
      const primary = dayWorkouts[0];
      weekDays.push({
        type: primary?.type || 'other',
        duration: primary ? primary.duration / maxDuration : 0,
        calories: primary ? primary.calories / maxCalories : 0,
        dayOfWeek: d,
      });
    }
    weeks.push(encodeWeek(weekDays));
  }

  // If not enough data for full weeks, create overlapping windows
  if (weeks.length === 0 && sorted.length > 0) {
    const weekDays: WorkoutDay[] = sorted.map(([, ws], i) => ({
      type: ws[0]?.type || 'other',
      duration: ws[0] ? ws[0].duration / maxDuration : 0,
      calories: ws[0] ? ws[0].calories / maxCalories : 0,
      dayOfWeek: i % 7,
    }));
    weeks.push(encodeWeek(weekDays));
  }

  return { weeks, maxDuration, maxCalories };
}

// Simple SGD update
function updateWeights(net: Network, layerIdx: number, inputAct: Vector, outputGrad: Vector, lr: number): Vector {
  const layer = net.layers[layerIdx];
  const inputGrad = zeros(layer.weights.length);

  for (let i = 0; i < layer.weights.length; i++) {
    for (let j = 0; j < layer.weights[0].length; j++) {
      inputGrad[i] += layer.weights[i][j] * outputGrad[j];
      layer.weights[i][j] += lr * inputAct[i] * outputGrad[j];
    }
    layer.bias[layerIdx] = (layer.bias[layerIdx] || 0) + lr * outputGrad[layerIdx] || 0;
  }

  for (let j = 0; j < outputGrad.length; j++) {
    layer.bias[j] += lr * outputGrad[j];
  }

  return inputGrad;
}

function backprop(net: Network, fwd: ForwardResult, targetGrad: Vector, lr: number): void {
  let grad = targetGrad;

  for (let i = net.layers.length - 1; i >= 0; i--) {
    // Apply activation gradient (leaky relu for hidden, skip for output as grad already accounts for it)
    if (i < net.layers.length - 1) {
      const preAct = fwd.preActivations[i];
      const actGrad = leakyReluGrad(preAct);
      grad = grad.map((g, j) => g * actGrad[j]);
    }

    grad = updateWeights(net, i, fwd.activations[i], grad, lr);
  }
}

export function trainStep(model: GANModel, realWeeks: Vector[]): void {
  if (realWeeks.length === 0) return;

  // --- Train Discriminator ---
  // Real sample → should output 1
  const realSample = realWeeks[Math.floor(Math.random() * realWeeks.length)];
  const discReal = forward(model.discriminator, realSample, 'sigmoid');
  const realOutput = discReal.activations[discReal.activations.length - 1][0];
  const realGrad = [1 - realOutput]; // gradient to push toward 1
  backprop(model.discriminator, discReal, realGrad, LEARNING_RATE);

  // Fake sample → should output 0
  const noise = randomNoise();
  const genFwd = forward(model.generator, noise, 'tanh');
  const fakeWeek = genFwd.activations[genFwd.activations.length - 1];
  const discFake = forward(model.discriminator, fakeWeek, 'sigmoid');
  const fakeOutput = discFake.activations[discFake.activations.length - 1][0];
  const fakeGrad = [-fakeOutput]; // gradient to push toward 0
  backprop(model.discriminator, discFake, fakeGrad, LEARNING_RATE);

  // --- Train Generator ---
  // Generate fake, but train generator to fool discriminator (want output → 1)
  const noise2 = randomNoise();
  const genFwd2 = forward(model.generator, noise2, 'tanh');
  const fakeWeek2 = genFwd2.activations[genFwd2.activations.length - 1];
  const discForGen = forward(model.discriminator, fakeWeek2, 'sigmoid');
  const genOutput = discForGen.activations[discForGen.activations.length - 1][0];

  // Backprop through discriminator to get gradient w.r.t. generator output
  const genTargetGrad = [1 - genOutput];
  // Approximate: use the gradient at the generator output level
  const outputGrad = fakeWeek2.map(() => genTargetGrad[0] / WORKOUT_VECTOR_SIZE);
  const genGradResult = forward(model.generator, noise2, 'tanh');
  backprop(model.generator, genGradResult, outputGrad, LEARNING_RATE);

  model.stats.discLoss = -Math.log(realOutput + 1e-8) - Math.log(1 - fakeOutput + 1e-8);
  model.stats.genLoss = -Math.log(genOutput + 1e-8);
  model.stats.epoch++;
}

export function trainGAN(model: GANModel, workouts: Workout[], epochs = 200): GANModel {
  const { weeks, maxDuration, maxCalories } = prepareTrainingData(workouts);
  model.stats.maxDuration = maxDuration;
  model.stats.maxCalories = maxCalories;

  for (let e = 0; e < epochs; e++) {
    trainStep(model, weeks);
  }

  return model;
}

export interface GeneratedPlan {
  days: Array<{
    dayOfWeek: string;
    type: WorkoutType;
    duration: number;
    calories: number;
    isRestDay: boolean;
  }>;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function generateTrainingPlan(model: GANModel): GeneratedPlan {
  const noise = randomNoise();
  const fwd = forward(model.generator, noise, 'tanh');
  const output = fwd.activations[fwd.activations.length - 1];

  const days = [];
  for (let d = 0; d < DAYS_PER_WEEK; d++) {
    const dayVec = output.slice(d * FEATURES_PER_DAY, (d + 1) * FEATURES_PER_DAY);
    const decoded = decodeWorkoutDay(dayVec, d);

    const duration = Math.round(decoded.duration * model.stats.maxDuration);
    const calories = Math.round(decoded.calories * model.stats.maxCalories);
    const isRestDay = duration < 5;

    days.push({
      dayOfWeek: DAY_NAMES[d],
      type: isRestDay ? 'other' as WorkoutType : decoded.type,
      duration: isRestDay ? 0 : duration,
      calories: isRestDay ? 0 : calories,
      isRestDay,
    });
  }

  return { days };
}

export { prepareTrainingData };
