import { HttpsGate } from "@/components/HttpsGate";
import { TutorShell } from "@/components/TutorShell";

export default function Home() {
  return (
    <HttpsGate>
      <TutorShell />
    </HttpsGate>
  );
}
