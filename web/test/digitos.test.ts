import { CLASSES, DIGIT_TEMPLATES, N, evaluate, generateDataset, predict, trainGradientDescent } from "../src/lib/digitos/model";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

function runToCompletion(config: Parameters<typeof trainGradientDescent>[0]) {
  const iterator = trainGradientDescent(config);
  let next = iterator.next();
  const snapshots = [];
  while (!next.done) {
    snapshots.push(next.value);
    next = iterator.next();
  }
  return { snapshots, result: next.value };
}

// --- Templates are well-formed ---
{
  assert(DIGIT_TEMPLATES.length === CLASSES, `there are exactly ${CLASSES} digit templates (${DIGIT_TEMPLATES.length})`);
  const allRightSize = DIGIT_TEMPLATES.every((t) => t.length === N);
  assert(allRightSize, `every template has exactly ${N} pixels`);
}

// --- Dataset generation ---
{
  const dataset = generateDataset(15, 0.25, 1);
  assert(dataset.length === 15 * CLASSES, `generateDataset(15, ...) yields ${15 * CLASSES} samples (${dataset.length})`);
  const inRange = dataset.every((s) => s.pixels.every((p) => p >= 0 && p <= 1));
  assert(inRange, "every pixel value stays clamped to [0, 1]");
}

// --- Training converges to high accuracy on the training distribution ---
const trainSet = generateDataset(15, 0.25, 10);
const testSet = generateDataset(8, 0.25, 999); // different seed - a held-out noise draw, not used in training
const { snapshots, result } = runToCompletion({
  dataset: trainSet,
  hiddenSize: 16,
  learningRate: 0.5,
  epochs: 120,
  seed: 20,
});
{
  assert(snapshots.length === 121, `yields one snapshot per epoch plus the initial one (${snapshots.length})`);
  const final = evaluate(result.finalNetwork, trainSet);
  assert(final.accuracy >= 0.9, `training accuracy reaches at least 90% (${(final.accuracy * 100).toFixed(1)}%)`);
  assert(final.loss < snapshots[0].loss, `loss decreases from the untrained network (${snapshots[0].loss.toFixed(3)}) to the trained one (${final.loss.toFixed(3)})`);
}

// --- Generalizes at least somewhat to noise draws never seen during training ---
{
  const test = evaluate(result.finalNetwork, testSet);
  console.log(`  (held-out test accuracy: ${(test.accuracy * 100).toFixed(1)}%)`);
  assert(test.accuracy >= 0.7, `generalizes to a held-out noise draw with at least 70% accuracy (${(test.accuracy * 100).toFixed(1)}%)`);
}

// --- Predicting a clean (noiseless) template classifies it correctly ---
{
  let correct = 0;
  for (let d = 0; d < CLASSES; d++) {
    if (predict(result.finalNetwork, DIGIT_TEMPLATES[d]) === d) correct++;
  }
  assert(correct === CLASSES, `every clean, noiseless template is classified correctly (${correct}/${CLASSES})`);
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("\nAll Digitos tests passed.");
}
