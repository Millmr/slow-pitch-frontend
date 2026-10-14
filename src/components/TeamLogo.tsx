import { useEffect, useState } from "react";
import { fetchTeamLogo } from "../api/teams";
import type { Team } from "../types";

// The logo endpoint needs the auth token, which an <img src> can't send, so
// each logo is fetched once per version and shown from an object URL.
const cache = new Map<string, Promise<string | null>>();

function logoUrl(teamId: number, version: string): Promise<string | null> {
  const key = `${teamId}:${version}`;
  let url = cache.get(key);
  if (!url) {
    url = fetchTeamLogo(teamId, version).then(
      (blob) => URL.createObjectURL(blob),
      () => {
        cache.delete(key); // try again next time
        return null;
      },
    );
    cache.set(key, url);
  }
  return url;
}

interface Props {
  team: Pick<Team, "id" | "logo_version"> | null | undefined;
  size?: number;
  className?: string;
}

/** The team's logo, or the softball mark when it doesn't have one. */
export default function TeamLogo({ team, size = 32, className = "" }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const teamId = team?.id;
  const version = team?.logo_version;

  useEffect(() => {
    if (!teamId || !version) {
      setSrc(null);
      return;
    }
    let active = true;
    logoUrl(teamId, version).then((url) => active && setSrc(url));
    return () => {
      active = false;
    };
  }, [teamId, version]);

  return (
    <img
      src={src ?? "/softball.svg"}
      alt=""
      width={size}
      height={size}
      className={`team-logo${src ? " has-logo" : ""}${className ? ` ${className}` : ""}`}
    />
  );
}
