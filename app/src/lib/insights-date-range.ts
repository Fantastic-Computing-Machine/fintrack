const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value: string | undefined) {
  return Boolean(
    value &&
      ISO_DATE.test(value) &&
      new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value,
  );
}

export function isValidCustomInsightsRange(
  start: string | undefined,
  end: string | undefined,
  today: string,
) {
  return Boolean(isDate(start) && isDate(end) && start <= end && end <= today);
}
