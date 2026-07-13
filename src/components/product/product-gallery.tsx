"use client";

// Interactive product gallery (Phase H #7). Client component: a main preview
// plus a thumbnail strip; clicking a thumbnail swaps the main preview. Images
// are delivered through Cloudinary transforms (f_auto/q_auto, resized) so we
// never ship full-res originals; a video streams only once it's the selected
// item (the <video> element is in the DOM only while selected, and preload is
// off), so nothing but the chosen media is fetched eagerly. Lead with an image.

import * as React from "react";
import { Play } from "lucide-react";

import {
  galleryMainUrl,
  galleryThumbUrl,
  videoPosterUrl,
} from "@/lib/cloudinary-url";
import { cn } from "@/lib/utils";

export type GalleryMedia = {
  id: string;
  url: string;
  altText: string | null;
  type: "IMAGE" | "VIDEO";
  isPrimary: boolean;
};

export function ProductGallery({
  media,
  productName,
}: {
  media: GalleryMedia[];
  productName: string;
}) {
  // Lead with an image: start on the primary image, else the first image, else
  // the first item (only reached if a product somehow has video-only media).
  const initialIndex = React.useMemo(() => {
    const primary = media.findIndex((m) => m.type === "IMAGE" && m.isPrimary);
    if (primary !== -1) return primary;
    const firstImage = media.findIndex((m) => m.type === "IMAGE");
    return firstImage !== -1 ? firstImage : 0;
  }, [media]);

  const [selected, setSelected] = React.useState(initialIndex);
  // media is always non-empty here (the page renders the SVG placeholder
  // instead when there is none) and `selected` is always in bounds.
  const active = media[selected]!;

  return (
    <div className="space-y-3">
      <div className="aspect-square overflow-hidden rounded-2xl bg-neutral-50">
        {active.type === "VIDEO" ? (
          <video
            key={active.id}
            controls
            preload="none"
            poster={videoPosterUrl(active.url)}
            className="size-full object-cover"
          >
            <source src={active.url} />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={galleryMainUrl(active.url)}
            alt={active.altText ?? productName}
            className="size-full object-cover"
          />
        )}
      </div>

      {media.length > 1 && (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {media.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={m.type === "VIDEO" ? "Play video" : "View image"}
              aria-current={i === selected}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl bg-neutral-50 transition",
                i === selected
                  ? "ring-2 ring-neutral-900 ring-offset-2"
                  : "hover:opacity-80",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.type === "VIDEO" ? videoPosterUrl(m.url) : galleryThumbUrl(m.url)}
                alt={m.altText ?? productName}
                loading="lazy"
                className="size-full object-cover"
              />
              {m.type === "VIDEO" && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-7 items-center justify-center rounded-full bg-black/60">
                    <Play className="size-3.5 fill-white text-white" />
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
