import { useIconMode } from "../../hooks/useIconMode";

export function AppearanceSettings() {
  const { mode, setMode } = useIconMode();
  const isEmoji = mode === "emoji";

  function handleToggle() {
    setMode(isEmoji ? "icons" : "emoji");
  }

  return (
    <section className="card max-w-md rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-caption font-semibold text-[var(--color-text)]">Icon Style</h2>
          <p className="mt-0.5 text-small">
            {isEmoji ? "Emojis — fun and playful" : "Lucide icons — clean and professional"}
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`relative inline-block h-6 w-11 rounded-full p-0 transition-colors ${
            isEmoji ? "bg-[var(--color-ok)]" : "bg-[var(--color-border-emphasis)]"
          }`}
          role="switch"
          aria-checked={isEmoji}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              isEmoji ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </section>
  );
}
