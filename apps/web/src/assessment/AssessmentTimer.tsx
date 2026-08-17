import { useEffect, useRef, useState } from "react";

export interface AssessmentTimerProps {
  expiresAt: string;
  onExpire?: () => void;
  now?: () => number;
}

export function remainingTimeMs(expiresAt: string, now: number): number {
  return Math.max(0, Date.parse(expiresAt) - now);
}

export function formatRemainingTime(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${clock}` : clock;
}

export function AssessmentTimer({
  expiresAt,
  onExpire,
  now = Date.now,
}: AssessmentTimerProps) {
  const [remainingMs, setRemainingMs] = useState(() =>
    remainingTimeMs(expiresAt, now()),
  );
  const expiredNotificationSent = useRef(false);

  useEffect(() => {
    const update = () => {
      const next = remainingTimeMs(expiresAt, now());
      setRemainingMs(next);
      if (next === 0 && !expiredNotificationSent.current) {
        expiredNotificationSent.current = true;
        onExpire?.();
      }
    };

    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [expiresAt, now, onExpire]);

  const warning = remainingMs > 0 && remainingMs <= 60_000;
  return (
    <div
      className={`assessment-timer${warning ? " assessment-timer--warning" : ""}`}
      aria-label="Time remaining"
      aria-live={warning ? "assertive" : "off"}
    >
      <span className="timer-dot" aria-hidden="true" />
      <span>{remainingMs === 0 ? "Time expired" : formatRemainingTime(remainingMs)}</span>
    </div>
  );
}
