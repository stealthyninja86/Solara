import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

const INPUT_CLASSES = "w-full rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text-tertiary)]";

export function ProfileSettings() {
  const { email, firstName, lastName, updateProfile, changePassword } = useAuth();

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
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="card rounded-2xl p-6">
        <h2 className="mb-4 text-caption font-medium text-[var(--color-text)]">Email</h2>
        <label htmlFor="profile-email" className="sr-only">Email address</label>
        <input
          id="profile-email"
          type="email"
          value={email ?? ""}
          disabled
          className="w-full rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text-muted)] opacity-60"
        />
      </div>

      <div className="card rounded-2xl p-6">
        <h2 className="mb-4 text-caption font-medium text-[var(--color-text)]">Name</h2>
        <div className="flex flex-col gap-3">
          <label htmlFor="profile-first-name" className="sr-only">First name</label>
          <input
            id="profile-first-name"
            type="text"
            placeholder="First name"
            value={firstNameValue}
            onChange={(e) => setFirstNameValue(e.target.value)}
            className={INPUT_CLASSES}
          />
          <label htmlFor="profile-last-name" className="sr-only">Last name</label>
          <input
            id="profile-last-name"
            type="text"
            placeholder="Last name"
            value={lastNameValue}
            onChange={(e) => setLastNameValue(e.target.value)}
            className={INPUT_CLASSES}
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={handleProfileSave} disabled={profileSaving} className="button button-primary">
            {profileSaving ? "Saving..." : "Save"}
          </button>
          {profileSuccess && <span className="text-caption text-[var(--color-ok)]">Saved</span>}
          {profileError && <span className="text-caption text-[var(--color-bad)]">{profileError}</span>}
        </div>
      </div>

      <div className="card rounded-2xl p-6">
        <h2 className="mb-4 text-caption font-medium text-[var(--color-text)]">Change Password</h2>
        <div className="flex flex-col gap-3">
          <label htmlFor="profile-current-password" className="sr-only">Current password</label>
          <input
            id="profile-current-password"
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={INPUT_CLASSES}
          />
          <label htmlFor="profile-new-password" className="sr-only">New password</label>
          <input
            id="profile-new-password"
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={INPUT_CLASSES}
          />
          <label htmlFor="profile-confirm-password" className="sr-only">Confirm new password</label>
          <input
            id="profile-confirm-password"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={INPUT_CLASSES}
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={handlePasswordSave} disabled={passwordSaving} className="button button-primary">
            {passwordSaving ? "Saving..." : "Save"}
          </button>
          {passwordSuccess && <span className="text-caption text-[var(--color-ok)]">Password changed</span>}
          {passwordError && <span className="text-caption text-[var(--color-bad)]">{passwordError}</span>}
        </div>
      </div>
    </div>
  );
}
