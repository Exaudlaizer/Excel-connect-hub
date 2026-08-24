"use client";

import { useRef, useState } from "react";
import { AlertCircle, ImagePlus, Loader2, Link2, Trash2, UploadCloud } from "lucide-react";
import { ApiError, uploadImage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Image field with two ways in: upload a file, or paste a link.
 *
 * Both end at the same place — a URL stored on the record — so a business that
 * already hosts its artwork elsewhere is not forced to re-upload it, and one
 * that does not is not forced to find hosting.
 *
 * The preview renders the real URL, so a broken or unreachable link is visible
 * before the form is submitted rather than after it reaches the catalogue.
 */
export function ImageUpload({
  label,
  value,
  onChange,
  hint,
  aspect = "aspect-[16/9]"
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
  aspect?: string;
}) {
  const { token } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [broken, setBroken] = useState(false);

  async function send(file: File | undefined) {
    if (!file) return;

    // Checked here as well as on the server: it saves the user a round trip and
    // a wasted upload on a slow connection.
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file (JPG, PNG, WebP, GIF or AVIF).");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("That image is larger than 4 MB. Please choose a smaller file.");
      return;
    }

    setError("");
    setBusy(true);
    try {
      const result = await uploadImage(file, token);
      setBroken(false);
      onChange(result.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That image could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="field-label mb-0">{label}</span>
        <button
          type="button"
          onClick={() => setShowLink((open) => !open)}
          className="focus-ring rounded text-xs font-semibold text-brand hover:underline"
        >
          {showLink ? "Upload a file" : "Use a link instead"}
        </button>
      </div>

      {value && !broken ? (
        <div className="relative overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className={`w-full ${aspect} bg-secondary object-cover`}
            onError={() => setBroken(true)}
          />
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="glass focus-ring rounded-lg px-2.5 py-1.5 text-xs font-bold"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setBroken(false);
              }}
              aria-label={`Remove ${label.toLowerCase()}`}
              className="glass focus-ring rounded-lg p-1.5 text-danger"
            >
              <Trash2 size={14} aria-hidden />
            </button>
          </div>
        </div>
      ) : showLink ? (
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} aria-hidden />
          <input
            type="url"
            value={value}
            placeholder="https://example.com/image.jpg"
            onChange={(event) => {
              setBroken(false);
              onChange(event.target.value.trim());
            }}
            className="field pl-9"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            send(event.dataTransfer.files?.[0]);
          }}
          disabled={busy}
          className={`focus-ring flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 transition-colors ${
            dragging ? "border-brand bg-brand/10" : "border-line bg-elevated hover:border-brand/50"
          }`}
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin text-brand" size={22} aria-hidden />
              <span className="text-sm font-semibold text-muted">Uploading…</span>
            </>
          ) : (
            <>
              {dragging ? (
                <UploadCloud className="text-brand" size={22} aria-hidden />
              ) : (
                <ImagePlus className="text-muted" size={22} aria-hidden />
              )}
              <span className="text-sm font-semibold text-ink">
                {dragging ? "Drop to upload" : "Click to upload, or drag an image here"}
              </span>
              <span className="text-xs text-muted">JPG, PNG, WebP, GIF or AVIF · up to 4 MB</span>
            </>
          )}
        </button>
      )}

      {broken && value && (
        <p className="alert alert-error mt-2" role="alert">
          <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span className="flex-1">
            That image could not be loaded. Check the link, or upload the file instead.
          </span>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setBroken(false);
            }}
            className="shrink-0 font-bold underline"
          >
            Clear
          </button>
        </p>
      )}

      {error && (
        <p className="alert alert-error mt-2" role="alert">
          <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      {hint && !error && !broken && <p className="mt-1.5 text-xs text-muted">{hint}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="sr-only"
        onChange={(event) => {
          send(event.target.files?.[0]);
          // Reset so choosing the same file twice still fires a change event.
          event.target.value = "";
        }}
      />
    </div>
  );
}
