import { runFastCubeChecks } from "./cube-checks";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

runFastCubeChecks(assert);

if (failures > 0) {
  console.error(`\n${failures} failure(s) in cube smoke test`);
  process.exit(1);
}
console.log(
  "\nAll cube smoke tests passed (2x2 and 3x3). Run `npm run test:cube` for the full exhaustive 2x2 state-count proof."
);
