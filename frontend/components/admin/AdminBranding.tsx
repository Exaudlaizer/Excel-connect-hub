"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ImageIcon } from "lucide-react";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Branding — admin control over the site's background images.
 *
 * The form is driven by the catalogue the server returns, not a hardcoded list,
 * so when a new branding slot is added on the backend it appears here with no
 * frontend change. Each slot is an ImageUpload, and saving is immediate: the
 * value is written the moment an image is chosen or cleared.
 */

type Setting = {
  key: string;
  label: string;
  description: string;
  type: string;
  isPublic: boolean;
  value: { url?: string };
};

function SettingRow({ setting }: { setting: Setting }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState(setting.value?.url || "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: (nextUrl: string) =>
      api(`/settings/${setting.key}`, { method: "PUT", token, body: JSON.stringify({ url: nextUrl }) }),
    onSuccess: () => {
      setError("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // Public pages read these; drop their cache so the change shows at once.
      queryClient.invalidateQueries({ queryKey: ["public-settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : "We could not save this image.")
  });

  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink">{setting.label}</h3>
          <p className="mt-1 text-xs leading-5 text-muted">{setting.description}</p>
        </div>
        {setting.isPublic ? (
          <span className="badge">Public</span>
        ) : (
          <span className="badge">Signed-in only</span>
        )}
      </div>

      <div className="mt-4">
        <ImageUpload
          label={setting.label}
          value={url}
          onChange={(next) => {
            setUrl(next);
            // Persist on change — choosing or clearing an image saves it.
            save.mutate(next);
          }}
          aspect="aspect-[21/9]"
          hint="Wide, high-resolution images work best. Recommended at least 1600px across."
        />
      </div>

      {error && (
        <p className="alert alert-error mt-3" role="alert">
          <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      {saved && !error && (
        <p className="alert alert-success mt-3" role="status">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>Saved. The change is live now.</span>
        </p>
      )}
    </div>
  );
}

export function AdminBranding() {
  const { token } = useAuth();

  const settings = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => api<{ settings: Setting[] }>("/settings", { token })
  });

  return (
    <section>
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-brand">
          <ImageIcon size={17} aria-hidden />
        </span>
        <div>
          <h2 className="text-heading text-ink">Branding &amp; backgrounds</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Upload or replace the background images shown across the platform. Changes take effect immediately.
          </p>
        </div>
      </div>

      {settings.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="card card-pad">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-4 aspect-[21/9] w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : settings.isError ? (
        <ErrorState error={settings.error} onRetry={() => settings.refetch()} title="We could not load branding" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(settings.data?.settings || []).map((setting) => (
            <SettingRow key={setting.key} setting={setting} />
          ))}
        </div>
      )}
    </section>
  );
}
