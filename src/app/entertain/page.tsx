import { redirect } from "next/navigation";
import { HttpsGate } from "@/components/HttpsGate";
import { EntertainPage } from "@/components/EntertainPage";
import { rewriteEntertainStudioSearch } from "@/lib/entertain/studio-path";

type Search = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, raw] of Object.entries(sp)) {
    const v = first(raw);
    if (v) q.set(k, v);
  }
  const dest = rewriteEntertainStudioSearch(q.toString());
  if (dest) redirect(dest);

  return (
    <HttpsGate>
      <EntertainPage />
    </HttpsGate>
  );
}
