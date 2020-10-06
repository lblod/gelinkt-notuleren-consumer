function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function exponentialGrowth(initial, rate, interval) {
  return Math.round((initial * Math.pow(1 + rate, interval)));
}

export {
  sleep,
  exponentialGrowth,
};