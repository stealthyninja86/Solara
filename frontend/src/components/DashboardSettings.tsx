import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useIconMode } from "../hooks/useIconMode";

export function DashboardSettings() {
  const { email, firstName, lastName, updateProfile, changePassword } = useAuth();
  const { mode, setMode } = useIconMode();
  const isEmoji = mode === "emoji";

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
    setTimeout(() => window.location.reload(), 50);
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
      {/* Profile Section */}
      <div>
        <h1 className="mb-4 text-[1.1rem] font-bold text-[var(--color-text)]">Profile</h1>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Email */}
          <div className="card rounded-2xl p-6">
            <h2 className="mb-4 text-[0.85rem] font-medium text-[var(--color-text)]">Email</h2>
            <input
              type="email"
              value={email ?? ""}
              disabled
              className="w-full rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-2 text-[0.85rem] text-[var(--color-text-muted)] opacity-60"
            />
          </div>

          {/* Name */}
          <div className="card rounded-2xl p-6">
            <h2 className="mb-4 text-[0.85rem] font-medium text-[var(--color-text)]">Name</h2>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="First name"
                value={firstNameValue}
                onChange={(e) => setFirstNameValue(e.target.value)}
                className="rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-2 text-[0.85rem] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text-tertiary)]"
              />
              <input
                type="text"
                placeholder="Last name"
                value={lastNameValue}
                onChange={(e) => setLastNameValue(e.target.value)}
                className="rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-2 text-[0.85rem] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text-tertiary)]"
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleProfileSave}
                disabled={profileSaving}
                className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-[0.8rem] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {profileSaving ? "Saving..." : "Save"}
              </button>
              {profileSuccess && (
                <span className="text-[0.8rem] text-[var(--color-ok)]">Saved</span>
              )}
              {profileError && (
                <span className="text-[0.8rem] text-[var(--color-bad)]">{profileError}</span>
              )}
            </div>
          </div>

          {/* Password */}
          <div className="card rounded-2xl p-6">
            <h2 className="mb-4 text-[0.85rem] font-medium text-[var(--color-text)]">Change Password</h2>
            <div className="flex flex-col gap-3">
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-2 text-[0.85rem] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text-tertiary)]"
              />
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-2 text-[0.85rem] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text-tertiary)]"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-2 text-[0.85rem] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text-tertiary)]"
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handlePasswordSave}
                disabled={passwordSaving}
                className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-[0.8rem] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {passwordSaving ? "Saving..." : "Save"}
              </button>
              {passwordSuccess && (
                <span className="text-[0.8rem] text-[var(--color-ok)]">Password changed</span>
              )}
              {passwordError && (
                <span className="text-[0.8rem] text-[var(--color-bad)]">{passwordError}</span>
              )}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[0.75rem] text-[var(--color-text-muted)]">
          Changes save instantly. If the header or overview doesn't update, hard refresh the page (Cmd+Shift+R).
        </p>
      </div>

      {/* Style Section */}
      <div>
        <h1 className="mb-4 text-[1.1rem] font-bold text-[var(--color-text)]">Style</h1>
        <section className="card max-w-md rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[0.85rem] font-semibold text-[var(--color-text)]">Icon Style</h2>
              <p className="mt-0.5 text-[0.75rem] text-[var(--color-text-muted)]">
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
      </div>
    </div>
  );
}
