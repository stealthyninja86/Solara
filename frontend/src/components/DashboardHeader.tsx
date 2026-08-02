import { useAuth } from "../hooks/useAuth";
import { ThemeToggle } from "./ThemeToggle";
import { Icon } from "./Icon";

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function DashboardHeader({ sidebarOpen, onToggleSidebar }: Props) {
  const auth = useAuth();

  return (
    <header className="mb-0! flex h-[44px] shrink-0 items-center justify-between px-4 pb-0!">
      <div className="flex items-center gap-2!">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            aria-label="Expand sidebar"
            className="mt-0! w-auto! cursor-pointer rounded-md bg-transparent! p-1 text-[0.9rem]! leading-none text-[var(--color-text-muted)]! transition-colors hover:bg-[var(--color-bg-hover)]! hover:text-[var(--color-text-secondary)]!"
          >
            ☰
          </button>
        )}
        <span className="text-lg leading-none"><Icon name="logo" size={18} /></span>
        <span className="text-[0.95rem] font-bold tracking-tight text-[var(--text)]">
          Solara
        </span>
      </div>

      <div className="flex items-center gap-2!">
        <ThemeToggle />
        <div className="flex items-center gap-1.5 rounded-md px-2 py-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-bg-hover)] text-[0.65rem] font-medium text-[var(--color-text-secondary)]">
            {auth.email?.charAt(0).toUpperCase()}
          </div>
          <span className="hidden text-[0.8rem] text-[var(--color-text-secondary)] sm:inline">
            {auth.email?.split("@")[0]}
          </span>
        </div>
      </div>
    </header>
  );
}
