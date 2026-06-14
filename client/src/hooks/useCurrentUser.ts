import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";
import { api, setTokenGetter } from "../lib/api.js";
import type { User } from "@soulseer/shared";

// Wires the API token getter to Auth0 and syncs/loads the internal user record.
export function useCurrentUser() {
  const { isAuthenticated, isLoading, user: auth0User, getAccessTokenSilently } = useAuth0();
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTokenGetter(() => getAccessTokenSilently());
  }, [getAccessTokenSilently]);

  useEffect(() => {
    let active = true;
    async function run() {
      if (isLoading) return;
      if (!isAuthenticated) {
        setMe(null);
        setLoading(false);
        return;
      }
      try {
        // Sync on first login (idempotent), then fetch profile.
        await api.post("/api/auth/sync", {
          email: auth0User?.email,
          fullName: auth0User?.name,
        });
        const profile = await api.get<User>("/api/auth/me", true);
        if (active) setMe(profile);
      } catch {
        if (active) setMe(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    run();
    return () => {
      active = false;
    };
  }, [isAuthenticated, isLoading, auth0User]);

  return { me, loading: loading || isLoading, isAuthenticated, refresh: () => setMe(null) };
}
