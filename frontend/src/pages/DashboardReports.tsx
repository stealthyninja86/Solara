import { Icon } from "../components/ui/Icon";

export function DashboardReports() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-[1.25rem] font-bold text-[var(--color-text)]"><Icon name="reports" size={18} /> Reports</h1>
      <p className="text-[0.8rem] text-[var(--color-text-muted)]">
        Monthly spend reports are coming soon.
      </p>
      <div className="mt-2 rounded-lg border border-dashed border-[var(--color-border-emphasis)] p-8 text-center">
        <div className="text-[0.8rem] text-[var(--color-text-muted)]">No reports yet</div>
      </div>
    </div>
  );
}
