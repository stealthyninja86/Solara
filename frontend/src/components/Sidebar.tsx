import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Icon } from "./Icon";

const NAVIGATION_ITEMS = [
  { to: "/dashboard", label: "Overview", icon: "overview" as const, end: true },
  { to: "/dashboard/reports", label: "Reports", icon: "reports" as const },
  { to: "/dashboard/settings", label: "Settings", icon: "settings" as const },
  // { to: "/dashboard/preview", label: "Preview", icon: "preview" as const },
];

export function Sidebar({ onCollapse }: { onCollapse: () => void }) {
  const auth = useAuth();

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col bg-[var(--color-surface)]">
      <div className="flex items-center justify-end px-4 pb-1 pt-4">
        <button
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          className="ml-auto! mt-0! w-auto! cursor-pointer rounded-md bg-transparent! p-1! text-[0.75rem]! leading-none text-[var(--color-text-muted)]! transition-colors hover:bg-[var(--color-bg-hover)]! hover:text-[var(--color-text-secondary)]!"
        >
          «
        </button>
      </div>

      <nav className="flex flex-col gap-2 px-4 pt-1 pb-3" aria-label="Main navigation">
        {NAVIGATION_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `mx-1 flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[0.95rem] transition-colors ${
                isActive
                  ? "bg-[var(--color-bg-active)] font-medium text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-secondary)]"
              }`
            }
          >
            <span className="text-[0.95rem] leading-none"><Icon name={item.icon} size={16} /></span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mx-4 border-t border-[var(--color-border-subtle)]" />

      <div className="flex-1" />

      <div className="px-4 pb-5">
        <button
          onClick={() => auth.logout().then(() => { window.location.href = "/"; })}
          className="mx-1 mt-0! flex w-[calc(100%-0.5rem)] cursor-pointer items-center gap-2.5 rounded-md bg-transparent! px-3! py-2! text-[0.8rem]! text-[var(--color-text-muted)]! transition-colors hover:bg-[var(--color-bg-hover)]! hover:text-[var(--color-danger)]!"
        >
          <Icon name="logout" size={14} />
          Logout
        </button>
        <div className="px-3 pt-1.5">
          <div className="truncate text-[0.65rem] text-[var(--color-text-tertiary)]">{auth.email}</div>
        </div>
      </div>
    </aside>
  );
}
