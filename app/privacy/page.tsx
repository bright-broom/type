import type { Metadata } from "next";
import { PrivacyScreen } from "@/src/presentation/components/privacy/PrivacyScreen";

export const metadata: Metadata = {
  title: "プライバシーと安全性 | TypeLoop",
  description: "TypeLoopが端末内に保存するデータと、安全な利用方法について説明します。",
};

export default function PrivacyPage() {
  return <PrivacyScreen />;
}
