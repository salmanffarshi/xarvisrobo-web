"use client";

// Floating contact buttons (Phase J.1). A small fixed stack in the bottom-right
// corner of the CUSTOMER-facing site linking to WhatsApp and Facebook Messenger.
// Settings-driven: the server wrapper (floating-contact-server.tsx) passes only
// the two fields this needs. Each button renders only when its value is present
// and usable; if neither is, nothing renders.
//
// The WhatsApp green (#25D366) and Messenger blue (#0084FF) brand colors are an
// intentional exception to the site's blue-only palette — they aid instant
// recognition of the contact channels.

import { buildWhatsAppUrl } from "@/lib/whatsapp";

// A pre-filled greeting for the WhatsApp chat. Neutral and short.
const WHATSAPP_GREETING = "Hi Xarvisrobo!";

// WhatsApp glyph (white on the green circle).
function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-7"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// Messenger glyph (white on the blue circle).
function MessengerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-7"
      aria-hidden="true"
    >
      <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z" />
    </svg>
  );
}

export function FloatingContact({
  whatsappNumber,
  messengerUrl,
}: {
  whatsappNumber: string;
  messengerUrl: string | null;
}) {
  // Only show WhatsApp when the number is a real-looking international number
  // (digits only, 10–15) — this excludes the "8801XXXXXXXXX" seed placeholder.
  const showWhatsApp = /^\d{10,15}$/.test(whatsappNumber);
  // Only show Messenger when a link is actually set.
  const messenger = messengerUrl?.trim() ?? "";
  const showMessenger = messenger.length > 0;

  if (!showWhatsApp && !showMessenger) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-3 sm:bottom-6 sm:right-6">
      {showWhatsApp && (
        <a
          href={buildWhatsAppUrl(whatsappNumber, WHATSAPP_GREETING)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp"
          className="flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
        >
          <WhatsAppIcon />
        </a>
      )}
      {showMessenger && (
        <a
          href={messenger}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Message us on Messenger"
          className="flex size-14 items-center justify-center rounded-full bg-[#0084FF] text-white shadow-lg transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF] focus-visible:ring-offset-2"
        >
          <MessengerIcon />
        </a>
      )}
    </div>
  );
}
