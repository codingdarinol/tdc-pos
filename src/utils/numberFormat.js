const formatterCache = new Map();

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getFormatter(minimumFractionDigits, maximumFractionDigits) {
  const key = `${minimumFractionDigits}:${maximumFractionDigits}`;
  if (!formatterCache.has(key)) {
    formatterCache.set(
      key,
      new Intl.NumberFormat('id-ID', {
        minimumFractionDigits,
        maximumFractionDigits,
      })
    );
  }
  return formatterCache.get(key);
}

export function formatNumber(value, minimumFractionDigits = 0, maximumFractionDigits = minimumFractionDigits) {
  return getFormatter(minimumFractionDigits, maximumFractionDigits).format(toFiniteNumber(value));
}

export function formatAmount(value) {
  return formatNumber(value, 2, 2);
}

export function formatPercent(value, digits = 1) {
  return formatNumber(value, digits, digits);
}
