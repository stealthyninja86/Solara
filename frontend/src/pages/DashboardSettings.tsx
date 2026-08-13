import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useAiStatus } from "../hooks/useAiStatus";
import { useIconMode } from "../hooks/useIconMode";

export function DashboardSettings() {
  const { email, firstName, lastName, updateProfile, changePassword, llmEnabled, updateSettings } = useAuth();
  const { mode, setMode } = useIconMode();
  const aiStatus = useAiStatus();
  const isEmoji = mode === "emoji";

  const llmOn = llmEnabled ?? true;
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmSuccess, setLlmSuccess] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  const [firstNameValue, setFirstNameValue] = useState(firstName ?? "");
  const [lastNameValue, setLastNameValue] = useState(lastName ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function handleIconToggle() {
    setMode(isEmoji ? "icons" : "emoji");
  }

  async function handleLlmToggle() {
    if (llmSaving) return;
    setLlmSaving(true);
    setLlmSuccess(false);
    setLlmError(null);
    try {
      await updateSettings({ llmEnabled: !llmOn });
      setLlmSuccess(true);
      setTimeout(() => setLlmSuccess(false), 3000);
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : "Failed to update settings");
    } finally {
      setLlmSaving(false);
    }
  }

  async function handleProfileSave() {
    setProfileSaving(true);
    setProfileSuccess(false);
    setProfileError(null);
    try {
      await updateProfile(firstNameValue || null, lastNameValue || null);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSave() {
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    setPasswordSaving(true);
    setPasswordSuccess(false);
    setPasswordError(null);
    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="mb-4 text-page">Profile</h1>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="card rounded-2xl p-6">
            <h2 className="mb-4 text-caption font-medium text-[var(--color-text)]">Email</h2>
            <input
              type="email"
              value={email ?? ""}
              disabled
              className="w-full rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text-muted)] opacity-60"
            />
          </div>

          <div className="card rounded-2xl p-6">
            <h2 className="mb-4 text-caption font-medium text-[var(--color-text)]">Name</h2>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="First name"
                value={firstNameValue}
                onChange={(e) => setFirstNameValue(e.target.value)}
                className="rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text-tertiary)]"
              />
              <input
                type="text"
                placeholder="Last name"
                value={lastNameValue}
                onChange={(e) => setLastNameValue(e.target.value)}
                className="rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text-tertiary)]"
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleProfileSave}
                disabled={profileSaving}
                className="button button-primary"
              >
                {profileSaving ? "Saving..." : "Save"}
              </button>
              {profileSuccess && (
                <span className="text-caption text-[var(--color-ok)]">Saved</span>
              )}
              {profileError && (
                <span className="text-caption text-[var(--color-bad)]">{profileError}</span>
              )}
            </div>
          </div>

          <div className="card rounded-2xl p-6">
            <h2 className="mb-4 text-caption font-medium text-[var(--color-text)]">Change Password</h2>
            <div className="flex flex-col gap-3">
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text-tertiary)]"
              />
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text-tertiary)]"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text-tertiary)]"
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handlePasswordSave}
                disabled={passwordSaving}
                className="button button-primary"
              >
                {passwordSaving ? "Saving..." : "Save"}
              </button>
              {passwordSuccess && (
                <span className="text-caption text-[var(--color-ok)]">Password changed</span>
              )}
              {passwordError && (
                <span className="text-caption text-[var(--color-bad)]">{passwordError}</span>
              )}
            </div>
          </div>
        </div>
        <p className="mt-3 text-small">
          Changes save instantly. If the header or overview doesn't update, hard refresh the page (Cmd+Shift+R).
        </p>
      </div>

      <div>
        <h1 className="mb-4 text-page">Style</h1>
        <section className="card max-w-md rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-caption font-semibold text-[var(--color-text)]">Icon Style</h2>
              <p className="mt-0.5 text-small">
                {isEmoji ? "Emojis — fun and playful" : "Lucide icons — clean and professional"}
              </p>
            </div>
            <button
              onClick={handleIconToggle}
              className={`relative h-6 w-11 rounded-full transition-colors ${
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

        <section className="card max-w-md rounded-2xl p-6 opacity-50 grayscale">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-caption font-semibold text-[var(--color-text)]">AI Features</h2>
              <p className="mt-0.5 text-small">
                {llmOn
                  ? "AI categorizes new transactions and writes your finance insights"
                  : "AI is off — no LLM calls are made, and insight cards are hidden"}
              </p>
            </div>
            <button
              onClick={handleLlmToggle}
              disabled
              className={`relative h-6 w-11 rounded-full transition-colors cursor-not-allowed ${
                llmOn ? "bg-[var(--color-ok)]" : "bg-[var(--color-border-emphasis)]"
              }`}
              role="switch"
              aria-checked={llmOn}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  llmOn ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="mt-3 min-h-4">
            {llmSaving && <span className="text-small">Updating...</span>}
            {!llmSaving && llmSuccess && <span className="text-small text-[var(--color-ok)]">Saved</span>}
            {!llmSaving && llmError && <span className="text-small text-[var(--color-bad)]">{llmError}</span>}
          </div>
          {!aiStatus.available && (
            <p className="mt-2 text-small text-[var(--color-bad)]">
              AI service is not available right now — insight cards are hidden. Please try again later.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
