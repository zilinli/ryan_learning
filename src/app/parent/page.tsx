import { redirect } from "next/navigation";

/** Audit alias — parent hub lives at /family (PIN-gated). */
export default function ParentPage() {
  redirect("/family");
}
