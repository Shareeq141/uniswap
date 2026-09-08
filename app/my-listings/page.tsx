"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, ArrowLeftRight, Edit3, Gift, Loader2, PackageOpen, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import LocationPicker, { LocationData } from "@/components/LocationPicker";
import { isSafePublicImageUrl } from "@/lib/utils";

type Listing = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  exchange_type?: string | null;
  type?: string | null;
  swap_want?: string | null;
  college_name?: string | null;
  campus?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  images?: string[] | null;
  status: string;
  created_at?: string | null;
};

type Draft = {
  title: string;
  description: string;
  category: string;
  condition: string;
  collegeName: string;
  exchangeType: "Give Away" | "Swap";
  swapWant: string;
  location: LocationData | null;
};

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

const conditions = ["New", "Like New", "Good", "Fair", "Used"];
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getStoragePath(publicUrl: string) {
  const marker = "/storage/v1/object/public/listing-images/";
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex < 0) return null;

  try {
    return decodeURIComponent(publicUrl.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

function validLocation(latitude: number | null | undefined, longitude: number | null | undefined): LocationData | null {
  return typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    ? { latitude, longitude }
    : null;
}

export default function MyListingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const previewsRef = useRef<string[]>([]);

  function revokeNewPreviews() {
    previewsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    previewsRef.current = [];
    setNewPreviews([]);
  }

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadListings() {
      if (authLoading) return;
      if (!user) {
        if (mounted) setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      const { data, error: listingsError } = await supabase
        .from("listings")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (!mounted) return;
      if (listingsError) {
        setError(listingsError.message);
        setListings([]);
      } else {
        setListings((data || []) as Listing[]);
      }
      setLoading(false);
    }

    void loadListings();
    return () => {
      mounted = false;
    };
  }, [authLoading, user]);

  function beginEdit(listing: Listing) {
    revokeNewPreviews();
    setExistingImages((listing.images || []).filter(isSafePublicImageUrl));
    setNewFiles([]);
    setDraft({
      title: listing.title,
      description: listing.description,
      category: listing.category,
      condition: listing.condition,
      collegeName: listing.college_name || listing.campus || "",
      exchangeType: (listing.exchange_type || listing.type || "Give Away").toLowerCase().includes("swap") ? "Swap" : "Give Away",
      swapWant: listing.swap_want || "",
      location: validLocation(listing.latitude, listing.longitude),
    });
    setEditingId(listing.id);
    setError(null);
  }

  function cancelEdit() {
    revokeNewPreviews();
    setNewFiles([]);
    setExistingImages([]);
    setDraft(null);
    setEditingId(null);
  }

  function updateDraft(field: keyof Draft, value: string | LocationData | null) {
    setDraft((current) => current ? { ...current, [field]: value } as Draft : current);
  }

  function handlePhotoSelect(event: ChangeEvent<HTMLInputElement>) {
    if (!draft) return;
    const files = Array.from(event.target.files || []).filter((file) => {
      if (!ACCEPTED_PHOTO_TYPES.has(file.type) || file.size > MAX_PHOTO_SIZE_BYTES) {
        setError("Photos must be JPG, PNG, or WebP files no larger than 5 MB.");
        return false;
      }
      return true;
    });
    const remaining = Math.max(0, 5 - existingImages.length - newFiles.length);
    const selected = files.slice(0, remaining);
    const previews = selected.map((file) => URL.createObjectURL(file));
    setNewFiles((current) => [...current, ...selected]);
    setNewPreviews((current) => {
      const next = [...current, ...previews];
      previewsRef.current = next;
      return next;
    });
    event.target.value = "";
  }

  function removeExistingImage(index: number) {
    setExistingImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function removeNewPhoto(index: number) {
    const preview = newPreviews[index];
    if (preview) URL.revokeObjectURL(preview);
    setNewFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setNewPreviews((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      previewsRef.current = next;
      return next;
    });
  }

  async function saveEdit() {
    if (!user || !draft || !editingId || saving) return;
    if (!draft.title.trim() || !draft.description.trim() || !draft.collegeName.trim() || !draft.category || !draft.condition) {
      setError("Title, description, college name, category, and condition are required.");
      return;
    }
    if (draft.exchangeType === "Swap" && !draft.swapWant.trim()) {
      setError("Please specify What I Want for a Swap listing.");
      return;
    }

    setSaving(true);
    setError(null);
    const uploadedPaths: string[] = [];

    try {
      const uploadedUrls: string[] = [];
      for (const file of newFiles) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const uniquePart = crypto.randomUUID();
        const path = `${user.id}/${uniquePart}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
        uploadedPaths.push(path);
        const { data: publicUrlData } = supabase.storage.from("listing-images").getPublicUrl(path);
        if (!publicUrlData.publicUrl) throw new Error("Photo upload did not return a permanent URL.");
        uploadedUrls.push(publicUrlData.publicUrl);
      }

      const nextImages = [...existingImages, ...uploadedUrls];
      const { data: updated, error: updateError } = await supabase
        .from("listings")
        .update({
          title: draft.title.trim(),
          description: draft.description.trim(),
          category: draft.category,
          condition: draft.condition,
          college_name: draft.collegeName.trim().replace(/\s+/g, " "),
          campus: draft.collegeName.trim().replace(/\s+/g, " "),
          exchange_type: draft.exchangeType,
          type: draft.exchangeType,
          swap_want: draft.exchangeType === "Swap" ? draft.swapWant.trim() : null,
          latitude: draft.location?.latitude ?? null,
          longitude: draft.location?.longitude ?? null,
          images: nextImages,
        })
        .eq("id", editingId)
        .eq("owner_id", user.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      const removedPaths = (listings.find((listing) => listing.id === editingId)?.images || [])
        .filter((image) => !nextImages.includes(image))
        .map(getStoragePath)
        .filter((path): path is string => Boolean(path));
      if (removedPaths.length > 0) {
        const { error: removeError } = await supabase.storage.from("listing-images").remove(removedPaths);
        if (removeError) console.warn("Could not remove deleted listing photos:", removeError.message);
      }

      setListings((current) => current.map((listing) => listing.id === editingId ? updated as Listing : listing));
      cancelEdit();
    } catch (saveError: unknown) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("listing-images").remove(uploadedPaths);
      }
      setError(getErrorMessage(saveError, "Could not save listing changes."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteListing(listing: Listing) {
    if (!user || deletingId) return;
    if (!window.confirm(`Delete “${listing.title}”? This cannot be undone.`)) return;

    setDeletingId(listing.id);
    setError(null);
    try {
      const { data: deleted, error: deleteError } = await supabase
        .from("listings")
        .delete()
        .eq("id", listing.id)
        .eq("owner_id", user.id)
        .select("id")
        .maybeSingle();
      if (deleteError) throw deleteError;
      if (!deleted) throw new Error("This listing could not be deleted. It may no longer belong to your account.");

      const paths = (listing.images || [])
        .map(getStoragePath)
        .filter((path): path is string => Boolean(path));
      if (paths.length > 0) {
        const { error: removeError } = await supabase.storage.from("listing-images").remove(paths);
        if (removeError) console.warn("Could not remove listing photos:", removeError.message);
      }
      setListings((current) => current.filter((item) => item.id !== listing.id));
      if (editingId === listing.id) cancelEdit();
    } catch (deleteError: unknown) {
      setError(getErrorMessage(deleteError, "Could not delete listing."));
    } finally {
      setDeletingId(null);
    }
  }

  if (authLoading || loading) {
    return <div className="min-h-screen bg-[#f7f7f3] flex flex-col"><Navbar /><div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-teal-600" size={24} /></div></div>;
  }

  if (!user) {
    return <div className="min-h-screen bg-[#f7f7f3] flex flex-col"><Navbar /><main className="flex-1 flex items-center justify-center p-6"><div className="glass-panel rounded-3xl p-8 text-center shadow-sm"><h1 className="text-2xl font-bold text-slate-900">Log in to view My Listings</h1><Link href="/login?redirect=/my-listings" className="glass-button mt-5 inline-flex rounded-xl px-5 py-3 text-sm font-semibold">Log in</Link></div></main></div>;
  }

  return (
    <div className="min-h-screen bg-[#f7f7f3] flex flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-slate-900">My Listings</h1><p className="mt-1 text-sm text-slate-500">Manage the items you published on UniSwap.</p></div>
          <Link href="/give" className="rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-600">List an Item</Link>
        </div>

        {error && <div className="mb-6 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={17} className="mt-0.5 shrink-0" /><span>{error}</span></div>}

        {listings.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center shadow-xs"><PackageOpen className="mx-auto text-teal-600" size={38} /><h2 className="mt-4 text-xl font-bold text-slate-900">No listings yet</h2><p className="mt-1 text-sm text-slate-500">Items you publish will appear here.</p></div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {listings.map((listing) => {
              const isSwap = (listing.exchange_type || listing.type || "").toLowerCase().includes("swap");
              const images = (listing.images || []).filter(isSafePublicImageUrl);
              const isEditing = editingId === listing.id && draft;
              return (
                <article key={listing.id} className="glass-elevated rounded-3xl p-5 shadow-xs">
                  <div className="flex gap-4">
                    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-100">{images[0] ? <Image src={images[0]} alt={listing.title} fill sizes="112px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-4xl">📦</div>}</div>
                    <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h2 className="truncate text-lg font-bold text-slate-900">{listing.title}</h2><span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold capitalize text-teal-700">{listing.status}</span></div><p className="mt-1 text-xs text-slate-500">{isSwap ? <><ArrowLeftRight className="mr-1 inline" size={13} />Swap</> : <><Gift className="mr-1 inline" size={13} />Give Away</>} · {listing.college_name || listing.campus || "College not provided"}</p><p className="mt-2 line-clamp-2 text-sm text-slate-600">{listing.description}</p></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => beginEdit(listing)} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-600"><Edit3 size={14} />Edit</button><button type="button" disabled={deletingId === listing.id} onClick={() => void deleteListing(listing)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={14} />{deletingId === listing.id ? "Deleting..." : "Delete"}</button>{listing.status === "available" && <Link href={`/marketplace/${listing.id}`} className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">View listing</Link>}</div>

                  {isEditing && (
                    <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
                      <div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">Edit listing</h3><button type="button" onClick={cancelEdit} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button></div>
                      <div className="grid gap-3 sm:grid-cols-2"><input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} maxLength={100} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="Item name" /><input value={draft.collegeName} onChange={(event) => updateDraft("collegeName", event.target.value)} maxLength={150} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="College name" /></div>
                      <textarea value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} maxLength={1000} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="Description" />
                      <div className="grid gap-3 sm:grid-cols-3"><select value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Category</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><select value={draft.condition} onChange={(event) => updateDraft("condition", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Condition</option>{conditions.map((condition) => <option key={condition} value={condition}>{condition}</option>)}</select><select value={draft.exchangeType} onChange={(event) => updateDraft("exchangeType", event.target.value as Draft["exchangeType"])} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="Give Away">Give Away</option><option value="Swap">Swap</option></select></div>
                      {draft.exchangeType === "Swap" && <input value={draft.swapWant} onChange={(event) => updateDraft("swapWant", event.target.value)} maxLength={150} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="What I Want" />}
                      <div><p className="mb-2 text-xs font-semibold text-slate-700">Photos</p><div className="flex flex-wrap gap-2">{existingImages.map((image, index) => <div key={image} className="relative h-16 w-16 overflow-hidden rounded-lg bg-slate-100"><Image src={image} alt="Listing photo" fill sizes="64px" className="object-cover" /><button type="button" onClick={() => removeExistingImage(index)} className="absolute right-0 top-0 rounded-bl bg-black/70 p-1 text-white"><X size={12} /></button></div>)}{newPreviews.map((preview, index) => <div key={preview} className="relative h-16 w-16 overflow-hidden rounded-lg bg-slate-100"><Image src={preview} alt="New listing photo" fill unoptimized sizes="64px" className="object-cover" /><button type="button" onClick={() => removeNewPhoto(index)} className="absolute right-0 top-0 rounded-bl bg-black/70 p-1 text-white"><X size={12} /></button></div>)}</div><label className="mt-3 inline-flex cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Add photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePhotoSelect} className="sr-only" /></label></div>
                      <LocationPicker value={draft.location} onChange={(location) => updateDraft("location", location)} />
                      <div className="flex gap-2"><button type="button" onClick={() => void saveEdit()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-600 disabled:opacity-50">{saving && <Loader2 size={14} className="animate-spin" />}Save changes</button><button type="button" onClick={cancelEdit} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700">Cancel</button></div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
