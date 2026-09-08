"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  Gift,
  ArrowLeftRight,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import LocationPicker, { LocationData } from "@/components/LocationPicker";

type ListingInsert = {
  owner_id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  college_name: string;
  campus: string;
  exchange_type: "Give Away" | "Swap";
  type: "Give Away" | "Swap";
  swap_want: string | null;
  status: "available";
  latitude: number | null;
  longitude: number | null;
  images: string[];
};

type SupabaseErrorDetails = {
  name?: string;
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: string;
  statusText?: string;
  stringRepresentation: string;
  jsonRepresentation: string;
  ownProperties: Record<string, unknown>;
};

const SENSITIVE_DIAGNOSTIC_KEY = /api.?key|authorization|password|secret|token/i;

function safeDiagnosticValue(
  value: unknown,
  seen = new WeakSet<object>()
): unknown {
  if (value === null || typeof value !== "object") {
    if (typeof value === "bigint") return value.toString();
    if (typeof value === "symbol" || typeof value === "function") return String(value);
    return value;
  }

  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  const snapshot: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    const propertyName = typeof key === "symbol" ? key.toString() : key;
    if (SENSITIVE_DIAGNOSTIC_KEY.test(propertyName)) {
      snapshot[propertyName] = "[REDACTED]";
      continue;
    }

    try {
      snapshot[propertyName] = safeDiagnosticValue(
        Reflect.get(value, key),
        seen
      );
    } catch (propertyError) {
      snapshot[propertyName] = `[Unreadable property: ${String(propertyError)}]`;
    }
  }

  return snapshot;
}

function safeJsonStringify(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? String(value) : serialized;
  } catch (jsonError) {
    return `[JSON serialization failed: ${String(jsonError)}]`;
  }
}

function safeStringRepresentation(value: unknown): string {
  try {
    return String(value);
  } catch (stringError) {
    return `[String conversion failed: ${safeJsonStringify(stringError)}]`;
  }
}

function readErrorValue(error: unknown, key: string): unknown {
  if (!error || (typeof error !== "object" && typeof error !== "function")) {
    return undefined;
  }

  try {
    return Reflect.get(error, key);
  } catch {
    return undefined;
  }
}

function toDiagnosticText(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return typeof value === "string" ? value : String(value);
}

function getSupabaseErrorDetails(error: unknown): SupabaseErrorDetails {
  const ownProperties = safeDiagnosticValue(error);

  return {
    name: toDiagnosticText(readErrorValue(error, "name")),
    message:
      toDiagnosticText(readErrorValue(error, "message")) ||
      (error instanceof Error ? error.message : undefined),
    code: toDiagnosticText(readErrorValue(error, "code")),
    details: toDiagnosticText(readErrorValue(error, "details")),
    hint: toDiagnosticText(readErrorValue(error, "hint")),
    status: toDiagnosticText(readErrorValue(error, "status")),
    statusText: toDiagnosticText(readErrorValue(error, "statusText")),
    stringRepresentation: safeStringRepresentation(error),
    jsonRepresentation: safeJsonStringify(error),
    ownProperties:
      ownProperties && typeof ownProperties === "object"
        ? (ownProperties as Record<string, unknown>)
        : { value: ownProperties },
  };
}

function formatSupabaseErrorForDisplay(details: SupabaseErrorDetails): string {
  const parts = [
    details.message,
    details.code ? `Code: ${details.code}` : undefined,
    details.details ? `Details: ${details.details}` : undefined,
    details.hint ? `Hint: ${details.hint}` : undefined,
    details.status ? `Status: ${details.status}` : undefined,
    details.statusText ? `Status text: ${details.statusText}` : undefined,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0
    ? parts.join(" | ")
    : `Supabase returned an unreadable error (${details.stringRepresentation}; JSON: ${details.jsonRepresentation}).`;
}

function getValidLocation(location: LocationData | null) {
  if (!location) return { latitude: null, longitude: null };

  const { latitude, longitude } = location;
  const isValid =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  return isValid
    ? { latitude, longitude }
    : { latitude: null, longitude: null };
}

const categories = [
  "Calculators",
  "Textbooks",
  "Stationery",
  "Drafting Tools",
  "Lab Equipment",
  "Lab Coats",
  "Electronics",
  "Other",
];

const conditions = [
  "New",
  "Like New",
  "Good",
  "Fair",
  "Used",
];

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PUBLISH_OPERATION_TIMEOUT_MS = 30_000;

function withTimeout<T>(operation: PromiseLike<T>, label: string, timeoutMs = PUBLISH_OPERATION_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);

    operation.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

async function timedPublishOperation<T>(
  label: string,
  operation: PromiseLike<T>,
  timeoutMs = PUBLISH_OPERATION_TIMEOUT_MS
): Promise<T> {
  console.time(label);
  try {
    return await withTimeout(operation, label, timeoutMs);
  } finally {
    console.timeEnd(label);
  }
}

export default function GivePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [exchangeType, setExchangeType] = useState<"Give Away" | "Swap">("Give Away");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    condition: "",
    swapWant: "",
    collegeName: "",
  });

  const [location, setLocation] = useState<LocationData | null>(null);

  // Photos
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const previewsRef = useRef<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const publishingRef = useRef(false);

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, []);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handlePhotoSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;

    const candidates = Array.from(files).filter((file) => {
      if (!ACCEPTED_PHOTO_TYPES.has(file.type)) {
        setSubmitError("Photos must be JPG, PNG, or WebP files.");
        return false;
      }
      if (file.size > MAX_PHOTO_SIZE_BYTES) {
        setSubmitError("Each photo must be 5 MB or smaller.");
        return false;
      }
      return true;
    });
    const newFiles = candidates.slice(0, 5 - selectedFiles.length);
    if (newFiles.length === 0) return;

    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));

    setSelectedFiles((prev) => [...prev, ...newFiles]);
    setPreviews((prev) => {
      const next = [...prev, ...newPreviews];
      previewsRef.current = next;
      return next;
    });
  }

  function removePhoto(index: number) {
    // Revoke object URL
    URL.revokeObjectURL(previews[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      const next = prev.filter((_, i) => i !== index);
      previewsRef.current = next;
      return next;
    });
  }

  function clearPreviews() {
    previewsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    previewsRef.current = [];
    setPreviews([]);
  }

  async function uploadPhotos(userId: string, uploadedPaths: string[]): Promise<string[]> {
    if (selectedFiles.length === 0) {
      console.time("publish:image-upload");
      console.timeEnd("publish:image-upload");
      return [];
    }

    const uploadResults = await timedPublishOperation(
      "publish:image-upload",
      Promise.allSettled(
        selectedFiles.map(async (file, index) => {
          const label = `publish:image-upload:${index + 1}`;
          console.time(label);
          try {
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
            const uniquePart = typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const filePath = `${userId}/${uniquePart}-${sanitizedName}`;

            const { error: uploadError } = await withTimeout(
              supabase.storage
                .from("listing-images")
                .upload(filePath, file, {
                  cacheControl: "3600",
                  upsert: true,
                }),
              label
            );

            if (uploadError) {
              throw new Error(
                uploadError.message.includes("row-level security")
                  ? "Photo upload was blocked by Supabase Storage permissions. Re-run the UniSwap schema in Supabase."
                  : `Photo upload failed: ${uploadError.message}`
              );
            }

            uploadedPaths.push(filePath);
            const { data: publicUrlData } = supabase.storage
              .from("listing-images")
              .getPublicUrl(filePath);

            if (!publicUrlData?.publicUrl) {
              throw new Error("Photo uploaded but Supabase did not return a permanent URL.");
            }

            return { fileIndex: index, publicUrl: publicUrlData.publicUrl };
          } finally {
            console.timeEnd(label);
          }
        })
      )
    );

    const failedUpload = uploadResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    if (failedUpload) throw failedUpload.reason;

    return uploadResults
      .filter(
        (result): result is PromiseFulfilledResult<{ fileIndex: number; publicUrl: string }> =>
          result.status === "fulfilled"
      )
      .sort((a, b) => a.value.fileIndex - b.value.fileIndex)
      .map((result) => result.value.publicUrl);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (publishingRef.current) return;
    publishingRef.current = true;
    setSubmitError(null);
    setUploading(true);

    const abortBeforePublish = (message: string, redirect = false) => {
      setSubmitError(message);
      publishingRef.current = false;
      setUploading(false);
      if (redirect) router.push("/login?redirect=/give");
    };

    const uploadedPaths: string[] = [];

    try {
      const {
        data: { session },
        error: sessionError,
      } = await timedPublishOperation("publish:session", supabase.auth.getSession(), 10_000);

      if (sessionError || !user || !session?.user) {
        abortBeforePublish("You must be logged in with a confirmed account to publish an item.", true);
        return;
      }

      if (user.id !== session.user.id) {
        abortBeforePublish("Your login session changed. Please refresh the page and try again.");
        return;
      }

      if (!form.title.trim()) {
        abortBeforePublish("Please enter an item name.");
        return;
      }

      if (!form.collegeName.trim()) {
        abortBeforePublish("Please enter your college name.");
        return;
      }

      if (form.collegeName.trim().length > 150) {
        abortBeforePublish("College name must be 150 characters or fewer.");
        return;
      }

      if (form.title.trim().length > 100) {
        abortBeforePublish("Item name must be 100 characters or fewer.");
        return;
      }

      if (exchangeType === "Swap" && !form.swapWant.trim()) {
        abortBeforePublish("Please specify what item you want in exchange (What I Want).");
        return;
      }

      if (exchangeType === "Swap" && form.swapWant.trim().length > 150) {
        abortBeforePublish("What I Want must be 150 characters or fewer.");
        return;
      }

      if (!form.description.trim()) {
        abortBeforePublish("Please provide a short description of the item.");
        return;
      }

      if (form.description.trim().length > 1000) {
        abortBeforePublish("Description must be 1000 characters or fewer.");
        return;
      }

      if (!form.category) {
        abortBeforePublish("Please select a category.");
        return;
      }

      if (!form.condition) {
        abortBeforePublish("Please select the item condition.");
        return;
      }

      // 1. Upload photos to Supabase Storage
      const authenticatedUserId = session.user.id;
      const permanentImageUrls = await uploadPhotos(authenticatedUserId, uploadedPaths);

      // 2. Insert listing into Supabase database
      const collegeName = form.collegeName.trim().replace(/\s+/g, " ");
      const { latitude, longitude } = getValidLocation(location);
      const listingPayload: ListingInsert = {
        owner_id: authenticatedUserId,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        condition: form.condition,
        college_name: collegeName,
        campus: collegeName,
        exchange_type: exchangeType,
        type: exchangeType,
        swap_want: exchangeType === "Swap" ? form.swapWant.trim() : null,
        status: "available",
        latitude,
        longitude,
        images: permanentImageUrls,
      };

      const { data: inserted, error: insertError } = await timedPublishOperation(
        "publish:listing-insert",
        supabase
          .from("listings")
          .insert(listingPayload)
          .select("id, status")
          .single()
      );

      if (insertError) {
        throw insertError;
      }

      if (!inserted?.id) {
        throw new Error("Supabase returned no listing row after the insert.");
      }

      setPublishedId(inserted.id);
    } catch (err: unknown) {
      // Best-effort cleanup prevents orphaned storage objects when the listing
      // insert fails after one or more photos have uploaded successfully.
      if (uploadedPaths.length > 0) {
        try {
          const { error: cleanupError } = await timedPublishOperation(
            "publish:image-cleanup",
            supabase.storage.from("listing-images").remove(uploadedPaths),
            10_000
          );
          if (cleanupError) {
            console.warn("Could not clean up uploaded listing photos:", cleanupError.message);
          }
        } catch (cleanupError: unknown) {
          console.warn("Could not clean up uploaded listing photos:", cleanupError);
        }
      }
      const details = getSupabaseErrorDetails(err);
      setSubmitError(formatSupabaseErrorForDisplay(details));
    } finally {
      publishingRef.current = false;
      setUploading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f7f7f3] flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 font-medium text-sm">
          <Loader2 className="animate-spin text-teal-600" size={20} />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!user && !authLoading) {
    return (
      <div className="min-h-screen bg-[#f7f7f3] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="glass-panel max-w-md w-full rounded-3xl p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 mb-4">
              <Gift size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Please Log In</h2>
            <p className="mt-2 text-sm text-slate-500">
              You need an active student account to publish items on UniSwap.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/login?redirect=/give"
                className="glass-button rounded-xl py-3 font-semibold transition"
              >
                Log In
              </Link>
              <Link
                href="/signup?redirect=/give"
                className="rounded-xl border border-slate-200 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Published Success State
  if (publishedId) {
    return (
      <div className="min-h-screen bg-[#f7f7f3] flex flex-col">
        <Navbar />
        <section className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-8 sm:p-10 text-center shadow-xl">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
              <CheckCircle2 size={44} />
            </div>

            <h1 className="text-3xl font-bold text-slate-900">
              Item Published!
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Your {exchangeType.toLowerCase()} listing is now available on the UniSwap campus marketplace. Other students nearby can find it and contact you.
            </p>

            <div className="mt-5 rounded-2xl bg-teal-50 p-4 text-xs font-medium text-teal-800">
              {location
                ? "Location coordinates saved for 1.5 km nearby student matching."
                : "Published without location. The listing remains available in the normal Marketplace results."}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/marketplace/${publishedId}`}
                className="glass-button rounded-xl px-6 py-3 text-sm font-semibold transition"
              >
                View Listing
              </Link>
              <Link
                href="/marketplace"
                className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Marketplace
              </Link>
              <button
                type="button"
                onClick={() => {
                  setPublishedId(null);
                  setForm({
                    title: "",
                    description: "",
                    category: "",
                    condition: "",
                    swapWant: "",
                    collegeName: "",
                  });
                  setSelectedFiles([]);
                  clearPreviews();
                  setLocation(null);
                  setExchangeType("Give Away");
                }}
                className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Give Another
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f3] flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Publish an Item
          </h1>
          <p className="mt-2 text-sm text-slate-500 max-w-lg mx-auto">
            Give away textbooks, calculators, and tools to students, or swap them directly with zero transaction fees.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-panel rounded-3xl p-6 sm:p-10 shadow-sm space-y-7"
        >
          {submitError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <AlertCircle className="text-red-600 mt-0.5 shrink-0" size={18} />
              <p className="text-sm font-medium text-red-700">{submitError}</p>
            </div>
          )}

          {/* EXCHANGE TYPE SELECTOR */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-3">
              Exchange Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExchangeType("Give Away")}
                className={`flex flex-col items-start p-4 rounded-2xl border text-left transition ${
                  exchangeType === "Give Away"
                    ? "border-teal-500 bg-teal-50/60 text-teal-900 ring-2 ring-teal-200"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-base">
                  <Gift size={18} className="text-teal-600" />
                  <span>Give Away</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Give it to another student for free. No item expected in return.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setExchangeType("Swap")}
                className={`flex flex-col items-start p-4 rounded-2xl border text-left transition ${
                  exchangeType === "Swap"
                    ? "border-teal-500 bg-teal-50/60 text-teal-900 ring-2 ring-teal-200"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-base">
                  <ArrowLeftRight size={18} className="text-teal-600" />
                  <span>Swap</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Exchange for another specific item you need (What I Have &harr; What I Want).
                </p>
              </button>
            </div>
          </div>

          {/* WHAT I HAVE / TITLE */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              {exchangeType === "Swap" ? "What I Have (Item Name)" : "Item Name"}
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Casio FX-991ES Plus Scientific Calculator"
              required
              maxLength={100}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {/* WHAT I WANT (ONLY FOR SWAP) */}
          {exchangeType === "Swap" && (
            <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-5 space-y-2 animate-in fade-in">
              <label className="block text-sm font-bold text-teal-900">
                What I Want in Return
              </label>
              <p className="text-xs text-teal-700">
                Specify what item, model, or equipment you are looking to swap this for.
              </p>
              <input
                type="text"
                name="swapWant"
                value={form.swapWant}
                onChange={handleChange}
                placeholder="e.g. Engineering Drawing Kit or 2nd Year Mechanical Textbook"
                required={exchangeType === "Swap"}
                maxLength={150}
                className="w-full rounded-xl border border-teal-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-200"
              />
            </div>
          )}

          {/* CATEGORY & CONDITION */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                Category
              </label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                Condition
              </label>
              <select
                name="condition"
                value={form.condition}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              >
                <option value="">Select condition</option>
                {conditions.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* COLLEGE NAME */}
          <div>
            <label htmlFor="collegeName" className="block text-sm font-semibold text-slate-900 mb-1.5">
              College Name
            </label>
            <input
              id="collegeName"
              type="text"
              name="collegeName"
              value={form.collegeName}
              onChange={handleChange}
              placeholder="e.g. ABC Engineering College"
              required
              maxLength={150}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            <p className="mt-1 text-xs text-slate-500">This helps students find listings from your college.</p>
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              required
              maxLength={1000}
              placeholder="Provide details such as edition, semester, working condition, or battery state..."
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {/* PHOTOS */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Photos (Optional, up to 5)
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Photos will be securely uploaded and stored on Supabase Storage.
            </p>

            <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center transition hover:border-teal-400 hover:bg-teal-50/50">
              <Camera className="mb-2 text-slate-400" size={26} />
              <span className="text-sm font-semibold text-slate-700">Add photos from device</span>
              <span className="text-xs text-slate-400 mt-0.5">PNG, JPG, WEBP up to 5MB</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handlePhotoSelect}
                disabled={selectedFiles.length >= 5}
              />
            </label>

            {previews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-3">
                {previews.map((previewUrl, index) => (
                  <div
                    key={previewUrl}
                    className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                  >
                    <Image
                      src={previewUrl}
                      alt={`Upload preview ${index + 1}`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/80 text-white hover:bg-slate-900"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* LOCATION PICKER */}
          <div className="pt-2 border-t border-slate-100">
            <LocationPicker value={location} onChange={setLocation} />
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={uploading}
            className="glass-button w-full rounded-2xl py-4 font-bold shadow-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Publishing Item to Supabase...</span>
              </>
            ) : (
              <span>Publish {exchangeType} Listing</span>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
