import { useRef, type ChangeEvent } from "react";
import { removeTeamLogo, uploadTeamLogo } from "../api/teams";
import { useAction } from "../lib/useApi";
import type { Team } from "../types";
import ErrorMessage from "./ErrorMessage";
import TeamLogo from "./TeamLogo";

const MAX_BYTES = 5 * 1024 * 1024;

/** Managers upload, replace or remove the team's logo. */
export default function TeamLogoSettings({ team, onChanged }: { team: Team; onChanged: (team: Team) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const action = useAction();

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be picked again after an error
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      action.setError("Choose an image file (PNG, JPEG, WebP or GIF).");
      return;
    }
    if (file.size > MAX_BYTES) {
      action.setError("That image is over 5 MB. Try a smaller file.");
      return;
    }
    const updated = await action.run(() => uploadTeamLogo(team.id, file));
    if (updated) onChanged(updated);
  }

  async function handleRemove() {
    if (!window.confirm("Remove the team logo?")) return;
    const done = await action.run(async () => {
      await removeTeamLogo(team.id);
      return true;
    });
    if (done) onChanged({ ...team, logo_version: null });
  }

  return (
    <section className="section">
      <h2 className="section-title">Team logo</h2>
      <div className="logo-settings">
        <TeamLogo team={team} size={72} className="logo-preview" />
        <div className="logo-settings-actions">
          <p className="hint">Shows next to the team name. PNG, JPEG, WebP or GIF, up to 5 MB; square images look best.</p>
          <div className="form-actions">
            <button
              type="button"
              className="button button-primary"
              disabled={action.pending}
              onClick={() => input.current?.click()}
            >
              {action.pending ? "Uploading…" : team.logo_version ? "Change logo" : "Upload logo"}
            </button>
            {team.logo_version && (
              <button type="button" className="button button-quiet" disabled={action.pending} onClick={handleRemove}>
                Remove
              </button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFile}
          />
        </div>
      </div>
      <ErrorMessage error={action.error} />
    </section>
  );
}
