import { useEffect, useState } from "react";

interface Props {
  seconds: number;
}

function format(remaining: number): string {
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function RetryCountdown({ seconds }: Props) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
    const id = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [seconds]);

  if (remaining <= 0) {
    return <span>ready to try again</span>;
  }
  return <span>try again in {format(remaining)}</span>;
}