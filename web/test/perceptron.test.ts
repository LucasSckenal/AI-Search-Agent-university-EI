import { generateDataset, trainGradientDescent, evaluate, TrainConfig } from "../src/lib/perceptron/model";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

function runToCompletion(config: TrainConfig) {
  const iterator = trainGradientDescent(config);
  let next = iterator.next();
  const snapshots = [];
  while (!next.done) {
    snapshots.push(next.value);
    next = iterator.next();
  }
  return { snapshots, result: next.value };
}

// --- Dataset generation ---
{
  const linear = generateDataset("linear", 120, 1);
  const circle = generateDataset("circle", 120, 2);
  const xor = generateDataset("xor", 120, 3);
  assert(linear.length === 120, `generateDataset("linear") returns the requested point count (${linear.length})`);
  assert(circle.length === 120, `generateDataset("circle") returns the requested point count (${circle.length})`);
  assert(xor.length === 120, `generateDataset("xor") returns the requested point count (${xor.length})`);
  for (const kind of ["linear", "circle", "xor"] as const) {
    const pts = generateDataset(kind, 120, 7);
    const zeros = pts.filter((p) => p.label === 0).length;
    const ones = pts.filter((p) => p.label === 1).length;
    assert(zeros > 0 && ones > 0, `generateDataset("${kind}") produces both classes (${zeros} vs ${ones})`);
  }
  const a = generateDataset("xor", 50, 42);
  const b = generateDataset("xor", 50, 42);
  assert(JSON.stringify(a) === JSON.stringify(b), "generateDataset is deterministic for a fixed seed");
}

// --- A single-layer perceptron solves a linearly separable dataset ---
{
  const dataset = generateDataset("linear", 120, 10);
  const { snapshots, result } = runToCompletion({
    dataset,
    useHidden: false,
    hiddenSize: 6,
    learningRate: 0.8,
    epochs: 150,
    seed: 100,
  });
  assert(snapshots.length === 151, `yields one snapshot per epoch plus the initial one (${snapshots.length})`);
  const final = evaluate(result.finalNetwork, dataset);
  assert(final.accuracy >= 0.95, `single-layer perceptron nearly solves a linearly separable dataset (accuracy ${final.accuracy.toFixed(2)})`);
  assert(final.loss < snapshots[0].loss, `loss decreases from the untrained network (${snapshots[0].loss.toFixed(3)}) to the trained one (${final.loss.toFixed(3)})`);
}

// --- Minsky-Papert: a single-layer perceptron CANNOT solve XOR or a circle ---
{
  for (const kind of ["xor", "circle"] as const) {
    const dataset = generateDataset(kind, 150, 20);
    const { result } = runToCompletion({
      dataset,
      useHidden: false,
      hiddenSize: 6,
      learningRate: 0.8,
      epochs: 200,
      seed: 200,
    });
    const final = evaluate(result.finalNetwork, dataset);
    assert(final.accuracy < 0.9, `single-layer perceptron plateaus well below solving "${kind}" (accuracy ${final.accuracy.toFixed(2)})`);
  }
}

// --- With a hidden layer, the same two problems become solvable ---
{
  for (const kind of ["xor", "circle"] as const) {
    const dataset = generateDataset(kind, 150, 30);
    const { result } = runToCompletion({
      dataset,
      useHidden: true,
      hiddenSize: 6,
      learningRate: 1.0,
      epochs: 300,
      seed: 300,
    });
    const final = evaluate(result.finalNetwork, dataset);
    assert(final.accuracy >= 0.9, `an MLP with a hidden layer solves "${kind}" (accuracy ${final.accuracy.toFixed(2)})`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll Perceptron tests passed.");
}
