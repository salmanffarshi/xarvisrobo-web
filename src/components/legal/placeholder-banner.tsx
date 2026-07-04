import { TriangleAlert } from "lucide-react";

// Prominent notice shared by the Privacy and Terms placeholder pages.
// Must stay visible until real legal copy lands (pre-launch, Phase G).
export function PlaceholderBanner() {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5"
    >
      <TriangleAlert
        className="mt-0.5 size-5 shrink-0 text-amber-600"
        strokeWidth={1.5}
        aria-hidden
      />
      <p className="text-sm leading-relaxed text-amber-900">
        This is placeholder content. Final version will be reviewed by legal
        counsel before public launch.
      </p>
    </div>
  );
}
