import { HttpsGate } from "@/components/HttpsGate";
import { EntertainPage } from "@/components/EntertainPage";

export default function StudioPage() {
  return (
    <HttpsGate>
      <EntertainPage forcedHub="studio" />
    </HttpsGate>
  );
}
