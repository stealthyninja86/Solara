import { ProfileSettings } from "../components/cards/ProfileSettings";
import { AppearanceSettings } from "../components/cards/AppearanceSettings";
import { AiSettings } from "../components/cards/AiSettings";

export function DashboardSettings() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="mb-4 text-page">Profile</h1>
        <ProfileSettings />
        <p className="mt-3 text-small">
          Changes save instantly. If the header or overview doesn't update, hard refresh the page (Cmd+Shift+R).
        </p>
      </div>

      <div>
        <h1 className="mb-4 text-page">Appearance</h1>
        <AppearanceSettings />
      </div>

      <div>
        <h1 className="mb-4 text-page">Intelligence</h1>
        <AiSettings />
      </div>
    </div>
  );
}
