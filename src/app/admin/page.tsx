"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  ImagePlus,
  Loader2,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Sprout,
  Trash2,
  X,
} from "lucide-react";
import type { GenericId } from "convex/values";
import { api } from "../../../convex/_generated/api";
import { getConvex } from "@/lib/convex";
import type { ArBundle, TargetInfo } from "@/lib/types";
import { RichEditor } from "@/components/ar/RichEditor";
import { loadMindARCompiler } from "@/lib/mindar-engine";
import {
  analyzeImage,
  buildArCard,
  canvasToImageEl,
  downloadBlob,
  enhanceForTracking,
  loadTargetImage,
  type TargetAnalysis,
} from "@/lib/ar-targets";

const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "guide-admin-2026";

const AUTH_KEY = "ar-admin-auth";

// ---------------------------------------------------------------- auth gate

function LoginGate({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "1");
      onAuthed();
    } else {
      setError(true);
    }
  };

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 font-sans flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Lock className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Admin</h1>
            <p className="text-xs text-zinc-500">Temple Guide content management</p>
          </div>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          placeholder="Admin password"
          className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          autoFocus
        />
        {error && (
          <p className="text-xs text-red-400">Wrong password, try again.</p>
        )}
        <button
          type="submit"
          className="w-full py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-colors"
        >
          Unlock
        </button>
        {!process.env.NEXT_PUBLIC_ADMIN_PASSWORD && (
          <p className="text-[11px] text-zinc-600 text-center">
            No NEXT_PUBLIC_ADMIN_PASSWORD set — using default. Set it in .env.local.
          </p>
        )}
      </form>
    </div>
  );
}

// ------------------------------------------------------- build AR tracking

// Compiles every target's reference image into a single MindAR `.mind` bundle
// and uploads it to Convex. The anchor order in the bundle is exactly the order
// of `trackable` here, which we persist as `targetIds` so the runtime can map
// anchor index → target.
function BuildTrackingPanel({
  targets,
  bundle,
  onBuilt,
}: {
  targets: TargetInfo[];
  bundle: ArBundle | null;
  onBuilt: () => void;
}) {
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [useFrame, setUseFrame] = useState(true);
  const [analysis, setAnalysis] = useState<
    Record<string, TargetAnalysis>
  >({});

  // Only targets that have a usable reference image can be tracked.
  const trackable = useMemo(
    () => targets.filter((t) => !!t.imageUrl),
    [targets]
  );
  const skipped = targets.length - trackable.length;

  // Grade each target image so weak photos (low contrast / blank space) are
  // caught before they silently fail to track.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const map: Record<string, TargetAnalysis> = {};
      for (const t of trackable) {
        try {
          const img = await loadTargetImage(t.imageUrl as string);
          if (cancelled) return;
          map[t._id] = analyzeImage(img);
        } catch {
          // keep going; per-target grading is best-effort
        }
      }
      if (!cancelled) setAnalysis(map);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [trackable]);

  const build = async () => {
    setBuilding(true);
    setError(null);
    setProgress(0);
    try {
      if (trackable.length === 0) {
        throw new Error(
          "No targets have a reference image. Add images first."
        );
      }

      // Weak photos are boosted (contrast stretch) and wrapped in a
      // high-frequency checkerboard frame so the tracker always has edges to
      // lock onto — see ar-targets.ts.
      const images = await Promise.all(
        trackable.map(async (t) => {
          const img = await loadTargetImage(t.imageUrl as string);
          const canvas = enhanceForTracking(img, { frame: useFrame });
          return canvasToImageEl(canvas);
        })
      );

      const { Compiler } = await loadMindARCompiler();
      const compiler = new Compiler();
      await compiler.compileImageTargets(images, (p: number) =>
        setProgress(Math.round(p))
      );
      const exported = await compiler.exportData();
      const blob = new Blob([exported as BlobPart], {
        type: "application/octet-stream",
      });

      const convex = getConvex();
      const uploadUrl = await convex.mutation(
        api.targets.generateUploadUrl,
        {}
      );
      const upload = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: blob,
      });
      if (!upload.ok) throw new Error("Bundle upload failed");
      const { storageId } = (await upload.json()) as {
        storageId: GenericId<"_storage">;
      };

      await convex.mutation(api.targets.saveArBundle, {
        mindStorageId: storageId,
        targetIds: trackable.map((t) => t._id),
      });
      onBuilt();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Build failed");
    } finally {
      setBuilding(false);
    }
  };

  // Printable 4:3 test cards — the guaranteed-trackable way to demo Live AR
  // (print the card, point the camera at it, it locks).
  const downloadCards = async () => {
    setError(null);
    for (const t of trackable) {
      try {
        const img = await loadTargetImage(t.imageUrl as string);
        const blob = await buildArCard(img, t.name);
        const slug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        downloadBlob(blob, `ar-card-${slug}.png`);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Card export failed");
      }
    }
  };

  const builtCount = bundle?.targetIds.length ?? 0;
  const stale =
    bundle !== null && builtCount !== trackable.length && !building;

  const analysisLabel = (a: TargetAnalysis) =>
    a.label === "poor"
      ? "Weak — needs a better photo"
      : a.label === "ok"
        ? "OK — frame recommended"
        : "Strong — tracks well";

  const analysisColor = (a: TargetAnalysis) =>
    a.label === "poor"
      ? "text-red-400"
      : a.label === "ok"
        ? "text-amber-400"
        : "text-emerald-400";

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Boxes className="w-5 h-5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-extrabold text-white">AR tracking</h2>
          <p className="text-xs text-zinc-500">
            Compile reference images so Live AR recognizes your objects.
          </p>
        </div>
      </div>

      <div className="text-xs text-zinc-400 space-y-1">
        <p>
          {trackable.length} of {targets.length} target
          {targets.length === 1 ? "" : "s"} have a reference image.
          {skipped > 0 && (
            <span className="text-amber-500"> {skipped} skipped (no image).</span>
          )}
        </p>
        <ul className="space-y-0.5">
          {trackable.map((t) => {
            const a = analysis[t._id];
            return (
              <li key={t._id} className="flex items-center gap-2">
                <span className="text-zinc-300 truncate max-w-[60%]">{t.name}</span>
                {a ? (
                  <span className={`font-semibold ${analysisColor(a)}`}>
                    {analysisLabel(a)}
                  </span>
                ) : (
                  <span className="text-zinc-600">grading…</span>
                )}
              </li>
            );
          })}
        </ul>
        {bundle ? (
          <p className="text-zinc-500">
            Last built {new Date(bundle.updatedAt).toLocaleString()} ·{" "}
            {builtCount} object{builtCount === 1 ? "" : "s"} in bundle.
            {stale && (
              <span className="text-amber-500"> Rebuild to include changes.</span>
            )}
          </p>
        ) : (
          <p className="text-zinc-600">
            Not built yet — Live AR can&apos;t track anything until you build.
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={useFrame}
          onChange={(e) => setUseFrame(e.target.checked)}
          className="accent-amber-500 w-3.5 h-3.5"
        />
        Add tracking frame (recommended — boosts weak photos)
      </label>

      {building && (
        <div className="space-y-1.5">
          <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] text-zinc-500">
            Compiling… {progress}% (this can take a minute)
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={build}
        disabled={building || trackable.length === 0}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-colors disabled:opacity-50"
      >
        {building ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Boxes className="w-4 h-4" />
        )}
        {building
          ? "Building…"
          : bundle
            ? "Rebuild AR tracking"
            : "Build AR tracking"}
      </button>
      <button
        onClick={downloadCards}
        disabled={building || trackable.length === 0}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-sm hover:bg-zinc-700 transition-colors disabled:opacity-50"
      >
        <ImagePlus className="w-4 h-4" />
        Download AR test cards
      </button>
    </div>
  );
}

// ------------------------------------------------------------- target editor

interface TargetForm {
  name: string;
  description: string;
  content: string;
}

const EMPTY_FORM: TargetForm = {
  name: "",
  description: "",
  content: "",
};

function TargetEditor({
  target,
  onSaved,
  onCancel,
}: {
  target: TargetInfo | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<TargetForm>(() =>
    target
      ? {
          name: target.name,
          description: target.description,
          content: target.content ?? "",
        }
      : { ...EMPTY_FORM }
  );
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const set = <K extends keyof TargetForm>(key: K, value: TargetForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Upload an image for the rich editor. Uses Convex storage when online so the
  // image is shared/persisted; falls back to an inline data URL when offline so
  // authoring never breaks (sync will still cache real URLs later).
  const uploadInlineImage = useCallback(async (file: File): Promise<string> => {
    try {
      const convex = getConvex();
      const uploadUrl = await convex.mutation(api.targets.generateUploadUrl, {});
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("upload failed");
      const { storageId } = (await res.json()) as {
        storageId: GenericId<"_storage">;
      };
      const url = await convex.query(api.targets.imageUrl, { storageId });
      if (!url) throw new Error("no url");
      return url;
    } catch {
      // Offline / upload failure — embed as a data URL so authoring continues.
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    }
  }, []);

  const handleFile = (file: File | null) => {
    setImage(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const convex = getConvex();

      let imageStorageId: string | undefined = target?.imageStorageId ?? undefined;
      let referenceImage: string | undefined = target?.referenceImage ?? undefined;

      if (image) {
        const uploadUrl = await convex.mutation(
          api.targets.generateUploadUrl,
          {}
        );
        const upload = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": image.type },
          body: image,
        });
        if (!upload.ok) throw new Error("Image upload failed");
        imageStorageId = (
          (await upload.json()) as { storageId: GenericId<"_storage"> }
        ).storageId;
        referenceImage = undefined;
      }

      const args = {
        name: form.name.trim(),
        description: form.description.trim(),
        content: form.content,
        imageStorageId: imageStorageId as GenericId<"_storage"> | undefined,
        referenceImage,
      };

      if (target) {
        await convex.mutation(api.targets.update, {
          id: target._id as GenericId<"targets">,
          ...args,
        });
      } else {
        await convex.mutation(api.targets.create, args);
      }
      onSaved();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to save target");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500";

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-white">
          {target ? `Edit — ${target.name}` : "New target"}
        </h2>
        <button
          onClick={onCancel}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1">
            Name
          </label>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Golden Temple Statue"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1">
            Short description
          </label>
          <textarea
            className={`${inputClass} resize-none`}
            rows={2}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="One-line summary shown on cards and the AR sheet"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1">
            Content
          </label>
          <RichEditor
            value={form.content}
            onChange={(html) => set("content", html)}
            onUploadImage={uploadInlineImage}
          />
          <p className="text-[11px] text-zinc-600 mt-1">
            Blog-style body with headings, lists, and images. Shown on the
            detail page.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1">
            Reference image (what the camera recognizes)
          </label>
          <p className="text-[11px] text-zinc-600 mb-2">
            Upload a clear, flat-on photo with good detail and contrast. This
            image is both the display hero and the AR tracking target.
          </p>
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition-colors"
            >
              <ImagePlus className="w-4 h-4" />
              {image ? "Replace image" : target ? "Upload new image" : "Upload image"}
            </button>
            {(imagePreview || target?.imageUrl) && (
              <img
                src={imagePreview ?? target?.imageUrl ?? ""}
                alt="preview"
                className="w-14 h-14 rounded-lg object-cover border border-zinc-700"
              />
            )}
            {target && !image && (
              <span className="text-[11px] text-zinc-600">
                Keeping current image
              </span>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : target ? "Save changes" : "Create target"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- admin shell

export default function AdminPage() {
  const [authed, setAuthed] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(AUTH_KEY) === "1"
  );
  const [targets, setTargets] = useState<TargetInfo[] | null>(null);
  const [bundle, setBundle] = useState<ArBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TargetInfo | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const convex = getConvex();
      const [list, arBundle] = await Promise.all([
        convex.query(api.targets.list, {}),
        convex.query(api.targets.getArBundle, {}),
      ]);
      setTargets(list);
      setBundle(arBundle as ArBundle | null);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load targets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) {
      // Deferred so the initial load doesn't set state synchronously during
      // the effect (which React compiler linting flags as cascading renders).
      const timer = setTimeout(() => reload(), 0);
      return () => clearTimeout(timer);
    }
  }, [authed, reload]);

  const seed = async () => {
    try {
      await getConvex().mutation(api.targets.seed, {});
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed");
    }
  };

  const remove = async (target: TargetInfo) => {
    if (!window.confirm(`Delete "${target.name}"? This cannot be undone.`)) return;
    try {
      await getConvex().mutation(api.targets.remove, {
        id: target._id as GenericId<"targets">,
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const logout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    setAuthed(false);
  };

  if (!authed) return <LoginGate onAuthed={() => setAuthed(true)} />;

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-300" />
            </Link>
            <h1 className="text-lg font-bold text-white">Admin — Targets</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={seed}
              title="Import the two static demo targets if the table is empty"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
            >
              <Sprout className="w-3.5 h-3.5" />
              Seed demo
            </button>
            <button
              onClick={reload}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
              title="Refresh from Convex"
            >
              <RefreshCw className={`w-4 h-4 text-zinc-300 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-red-500/20 text-xs font-medium text-zinc-300 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {(creating || editing) && (
          <TargetEditor
            target={editing}
            onSaved={() => {
              setCreating(false);
              setEditing(null);
              reload();
            }}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        )}

        {!creating && !editing && (
          <button
            onClick={() => setCreating(true)}
            className="w-full py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New target
          </button>
        )}

        {!creating && !editing && targets && targets.length > 0 && (
          <BuildTrackingPanel
            targets={targets}
            bundle={bundle}
            onBuilt={reload}
          />
        )}

        {targets === null ? (
          <p className="text-sm text-zinc-500 text-center py-10">Loading…</p>
        ) : targets.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <p className="text-sm text-zinc-400">
              No targets yet. Create one, or seed the demo data.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {targets.map((target) => (
              <li
                key={target._id}
                className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex items-center gap-4"
              >
                {target.imageUrl ? (
                  <img
                    src={target.imageUrl}
                    alt={target.name}
                    className="w-16 h-16 rounded-xl object-cover border border-zinc-700 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                    <span className="text-[10px] text-zinc-600">No img</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {target.name}
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {target.imageUrl ? (
                      bundle?.targetIds.includes(target._id) ? (
                        <span className="text-emerald-500">In AR bundle</span>
                      ) : (
                        <span className="text-amber-500">
                          Not built — rebuild AR tracking
                        </span>
                      )
                    ) : (
                      <span className="text-zinc-600">
                        No reference image — not trackable
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-zinc-600">
                    updated {new Date(target.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setCreating(false);
                      setEditing(target);
                    }}
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(target)}
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                    title="Delete target"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
