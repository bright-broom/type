"use client";

import { useRouter } from "next/navigation";
import { TakkenGlossary } from "../takken/TakkenGlossary.tsx";

export function TakkenGlossaryRoute({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  return (
    <TakkenGlossary
      initialQuery={initialQuery}
      onBack={() => router.push("/takken")}
      onStart={() => router.push("/?training=takken")}
    />
  );
}
