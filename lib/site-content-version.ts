export function isSiteContentVersionCurrent(
  expected: string | null,
  current: string | undefined
): boolean {
  return expected === null ? current === undefined : expected === current;
}

export function nextSiteContentUpdatedAt(previous: string | undefined, nowMs: number): string {
  const previousMs = previous === undefined ? -Infinity : Date.parse(previous);
  if (!Number.isFinite(nowMs) || Number.isNaN(previousMs)) {
    throw new RangeError("La versión del contenido no tiene una fecha válida.");
  }

  return new Date(Math.max(previousMs, nowMs) + 1).toISOString();
}
