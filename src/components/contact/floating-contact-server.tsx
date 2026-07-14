// Server wrapper for the floating contact buttons (Phase J.1). Reads the
// Settings singleton on the server and passes ONLY the two fields the client
// button needs — no other Settings values reach the client. Mounted in the
// customer-facing layouts (never admin).
//
// getContactSettings() selects just the two contact fields on purpose: React
// serializes this awaited value into the RSC payload, so awaiting the full
// Settings row here would ship every field to the browser.

import { getContactSettings } from "@/services/settings-service";
import { FloatingContact } from "@/components/contact/floating-contact";

export async function FloatingContactServer() {
  const { whatsappNumber, messengerUrl } = await getContactSettings();
  return (
    <FloatingContact
      whatsappNumber={whatsappNumber}
      messengerUrl={messengerUrl}
    />
  );
}
