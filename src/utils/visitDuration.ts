interface DurationInput {
  check_in_at?: string | null;
  check_out_at?: string | null;
  duration_seconds?: number | null;
  duration_minutes?: number | null;
}

function isValidNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function isValidTimestamp(ts: unknown): ts is string {
  return typeof ts === 'string' && ts.length > 0 && !Number.isNaN(new Date(ts).getTime());
}

export function calculateVisitDurationSeconds(input: DurationInput): number | null {
  if (isValidTimestamp(input.check_in_at) && isValidTimestamp(input.check_out_at)) {
    const diff = Math.floor(
      (new Date(input.check_out_at).getTime() - new Date(input.check_in_at).getTime()) / 1000,
    );
    if (diff > 0) return diff;
  }
  if (isValidNumber(input.duration_seconds)) return input.duration_seconds;
  if (isValidNumber(input.duration_minutes)) return input.duration_minutes * 60;
  return null;
}

export function formatVisitDuration(input: DurationInput): string {
  const totalSeconds = calculateVisitDurationSeconds(input);
  if (totalSeconds === null || totalSeconds <= 0) return '-';
  if (totalSeconds < 60) return '<1 min';
  if (totalSeconds < 120) return '1 min';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
