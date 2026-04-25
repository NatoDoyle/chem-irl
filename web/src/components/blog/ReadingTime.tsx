export function ReadingTime({ minutes, className }: { minutes: number; className?: string }) {
  return (
    <span className={className}>
      {minutes} min read
    </span>
  );
}
