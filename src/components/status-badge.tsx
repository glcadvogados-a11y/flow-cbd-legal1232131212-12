import type { StatusColor } from "@/lib/domain";

export function StatusBadge({
  color,
  label,
}: {
  color: StatusColor;
  label: string;
}) {
  const styles: Record<StatusColor, string> = {
    red: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900",
    yellow:
      "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-900",
    green:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900",
    gray: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[color]}`}
    >
      {label}
    </span>
  );
}
