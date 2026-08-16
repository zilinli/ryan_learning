import { HttpsGate } from "@/components/HttpsGate";
import { EntertainPage } from "@/components/EntertainPage";

/**
 * Keep this page sync (no searchParams) so production can statically prerender.
 * Legacy `?hub=studio` → `/studio` lives in `src/middleware.ts`.
 */
export default function Page() {
  return (
    <HttpsGate>
      <EntertainPage />
    </HttpsGate>
  );
}
