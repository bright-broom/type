"use client";

import { useRouter } from "next/navigation";
import { TakkenGlossary } from "../takken/TakkenGlossary.tsx";

/** Lightweight direct-route adapter; the home composition owns its in-app overlay. */
export function TakkenGlossaryRoute() {
  const router = useRouter();
  return <TakkenGlossary onBack={() => router.push("/takken")} onStart={() => router.push("/?training=takken")} />;
}
