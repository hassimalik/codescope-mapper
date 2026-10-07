import { localTarget as aliasedTarget } from "./helpers";
import { readFileSync } from "node:fs";

function sameFileTarget() {
  return "same-file";
}

const arrowTarget = () => "arrow-target";

const service = { sameFileTarget };

const arrowCaller = () => {
  arrowTarget();
};

export function run() {
  sameFileTarget();
  aliasedTarget();
  aliasedTarget();
  service.sameFileTarget();
}

export const importedReference = aliasedTarget;
