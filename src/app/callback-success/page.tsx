"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sanitizeRedirectPath } from "@/lib/authFlow";

function CallbackSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const redirectTarget = sanitizeRedirectPath(searchParams.get("redirect"));
    router.replace(redirectTarget);
  }, [router, searchParams]);

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#0A0D09] text-white">
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
      <p className="text-sm text-white/80">Signing you in...</p>
    </div>
  );
}

export default function CallbackSuccessPage() {
  return (
    <Suspense fallback={<section className="min-h-screen bg-[#0A0D09]" />}>
      <CallbackSuccessContent />
    </Suspense>
  );
}
