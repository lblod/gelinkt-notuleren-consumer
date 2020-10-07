function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function exponentialGrowth(initial, rate, interval) {
  return Math.round((initial * Math.pow(1 + rate, interval)));
}

function isInverse(predicate) {
  return predicate && predicate.startsWith('^');
}

function sparqlEscapePredicate(predicate) {
  return isInverse(predicate) ? `^<${predicate.slice(1)}>` : `<${predicate}>`;
}

export {
  sleep,
  exponentialGrowth,
  isInverse,
  sparqlEscapePredicate
};