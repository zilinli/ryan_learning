import { HttpsGate } from "@/components/HttpsGate";
import { EntertainPage } from "@/components/EntertainPage";

export default function Page() {
  return (
    <HttpsGate>
      <EntertainPage />
    </HttpsGate>
  );
}
