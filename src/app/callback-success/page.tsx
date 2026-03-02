// app/auth/callback-success/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CallbackSuccess() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/dashboard");
    }, [router]);

    return <div className="flex h-screen flex-col items-center justify-center  text-white">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
        <p className="text-sm text-white/80">Signing you in...</p>
    </div>

}
