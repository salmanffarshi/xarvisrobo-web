// Server wrapper for the floating contact buttons (Phase J.1). Reads the
// Settings singleton on the server and passes ONLY the two fields the client
// button needs — no other Settings values reach the client. Mounted in the
// customer-facing layouts (never admin).

import { getSettings } from "@/services/settings-service";
import { FloatingContact } from "@/components/contact/floating-contact";

export async function FloatingContactServer() {
  const { whatsappNumber, messengerUrl } = await getSettings();
  return (
    <FloatingContact
      whatsappNumber={whatsappNumber}
      messengerUrl={messengerUrl}
    />
  );
}
