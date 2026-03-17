// Format satoshi to BTC string
export const formatBtc = (satoshi: number): string => {
  const btc = satoshi / 100_000_000;
  if (btc >= 1) {
    return `${btc.toFixed(4)} BTC`;
  } else if (btc >= 0.0001) {
    return `${(btc * 1000).toFixed(4)} mBTC`;
  } else {
    return `${satoshi.toLocaleString()} sat`;
  }
};

// Format satoshi to short string
export const formatSatoshi = (satoshi: number): string => {
  if (satoshi >= 100_000_000_000) {
    return `${(satoshi / 100_000_000).toFixed(2)} BTC`;
  } else if (satoshi >= 100_000_000) {
    return `${(satoshi / 100_000_000).toFixed(4)} BTC`;
  } else if (satoshi >= 1_000_000) {
    return `${(satoshi / 1_000_000).toFixed(2)}M sat`;
  } else if (satoshi >= 1_000) {
    return `${(satoshi / 1_000).toFixed(1)}K sat`;
  }
  return `${satoshi} sat`;
};

// Format hashrate
export const formatHashrate = (hashrate: number): string => {
  if (hashrate >= 1_000_000_000_000) {
    return `${(hashrate / 1_000_000_000_000).toFixed(2)} TH/s`;
  } else if (hashrate >= 1_000_000_000) {
    return `${(hashrate / 1_000_000_000).toFixed(2)} GH/s`;
  } else if (hashrate >= 1_000_000) {
    return `${(hashrate / 1_000_000).toFixed(2)} MH/s`;
  } else if (hashrate >= 1_000) {
    return `${(hashrate / 1_000).toFixed(2)} KH/s`;
  }
  return `${hashrate} H/s`;
};

// Format large numbers
export const formatNumber = (num: number): string => {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  } else if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
};

// Get era color
export const getEraColor = (era: string): string => {
  switch (era) {
    case 'cpu':
      return '#4CAF50';
    case 'gpu':
      return '#2196F3';
    case 'fpga':
      return '#9C27B0';
    case 'asic':
      return '#FF9800';
    default:
      return '#757575';
  }
};

// Get era icon name
export const getEraIcon = (era: string): string => {
  switch (era) {
    case 'cpu':
      return 'cpu';
    case 'gpu':
      return 'gpu-card';
    case 'fpga':
      return 'chip';
    case 'asic':
      return 'server';
    default:
      return 'help-circle';
  }
};
