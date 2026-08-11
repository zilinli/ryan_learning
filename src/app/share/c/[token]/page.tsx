import type { Metadata } from "next";
import { ShareCreationClient } from "./ShareCreationClient";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Shared creation · Spark Studio",
    description: "A song or video shared from Spark Writing Studio.",
    openGraph: {
      title: "Shared creation · Spark Studio",
      description: "Listen or watch a student creation.",
      url: `/share/c/${encodeURIComponent(token)}`,
    },
  };
}

export default async function ShareCreationPage({ params }: Props) {
  const { token } = await params;
  return <ShareCreationClient token={token} />;
}
