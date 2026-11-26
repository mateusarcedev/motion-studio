export function parseDeterminismReplayArgs(argv) {
  const options = { source: null, runs: 2, evidenceDir: null, expectDifference: false, help: false };
  const takeValue = (name, index) => {
    const argument = argv[index];
    const prefix = name + "=";
    if (argument.startsWith(prefix)) return [argument.slice(prefix.length), index];
    if (argument === name) {
      if (!argv[index + 1] || argv[index + 1].startsWith("--")) throw new Error("Missing value for " + name);
      return [argv[index + 1], index + 1];
    }
    return [null, index];
  };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--help" || argv[i] === "-h") { options.help = true; continue; }
    if (argv[i] === "--expect-difference") { options.expectDifference = true; continue; }
    let value;
    [value, i] = takeValue("--source", i);
    if (value !== null) { options.source = value; continue; }
    [value, i] = takeValue("--runs", i);
    if (value !== null) {
      options.runs = Number(value);
      if (!Number.isInteger(options.runs) || options.runs < 2 || options.runs > 8) {
        throw new Error("--runs must be an integer from 2 to 8");
      }
      continue;
    }
    [value, i] = takeValue("--evidence-dir", i);
    if (value !== null) { options.evidenceDir = value; continue; }
    throw new Error("Unknown argument: " + argv[i]);
  }

  if (!options.help && !options.source) throw new Error("--source is required");
  return options;
}

export function classifyDeterminismComparisons(comparisons, { executionErrors = [], expectDifference = false } = {}) {
  const confirmedDifferences = comparisons.filter((item) => item?.status === "different" && item?.identical === false);
  const unreadable = comparisons.filter((item) => item?.status === "read-error");
  const malformed = comparisons.filter((item) =>
    !item ||
    (item.status === "identical" && item.identical !== true) ||
    (item.status === "different" && item.identical !== false) ||
    !["identical", "different", "read-error"].includes(item.status),
  );
  const inconclusiveCount = unreadable.length + malformed.length;

  if (confirmedDifferences.length) {
    return {
      status: "FAIL_CONFIRMED",
      exitCode: 1,
      confirmedDifferences: confirmedDifferences.length,
      inconclusiveComparisons: inconclusiveCount,
      reason: "at-least-one-completed-media-comparison-differed",
    };
  }
  if (executionErrors.length || inconclusiveCount || comparisons.length === 0 || expectDifference) {
    return {
      status: "INCONCLUSIVE",
      exitCode: 2,
      confirmedDifferences: 0,
      inconclusiveComparisons: inconclusiveCount,
      reason: executionErrors.length || inconclusiveCount || comparisons.length === 0 ? "one-or-more-attempts-could-not-be-compared" : "expected-difference-was-not-reproduced",
    };
  }
  return {
    status: "PASS",
    exitCode: 0,
    confirmedDifferences: 0,
    inconclusiveComparisons: 0,
    reason: "all-completed-comparisons-were-identical",
  };
}
