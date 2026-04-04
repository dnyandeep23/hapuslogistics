"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import Skeleton from "@/components/Skeleton";
import { useAppSelector } from "@/lib/redux/hooks";

type SupportResponse = {
  success: boolean;
  support?: {
    name: string;
    email: string;
    phone: string;
  };
  message?: string;
};

function toTelHref(phone: string): string {
  const normalized = phone.trim().replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : "";
}

function toMailHref(email: string): string {
  const normalized = email.trim();
  return normalized ? `mailto:${normalized}` : "";
}

export default function SupportPage() {
  const { user } = useAppSelector((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [support, setSupport] = useState<{ name: string; email: string; phone: string } | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadSupport = async () => {
      if (!user) return;

      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/dashboard/support", {
          cache: "no-store",
        });
        const payload = (await response.json()) as SupportResponse;

        if (!active) return;

        if (!response.ok || !payload.success) {
          setSupport(null);
          setError(payload.message || "Failed to load support details.");
          return;
        }

        setSupport({
          name: String(payload.support?.name ?? "").trim(),
          email: String(payload.support?.email ?? "").trim(),
          phone: String(payload.support?.phone ?? "").trim(),
        });
      } catch (fetchError: unknown) {
        if (!active) return;
        setSupport(null);
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load support details.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSupport();

    return () => {
      active = false;
    };
  }, [user]);

  const supportName = String(support?.name ?? "").trim() || "Support";
  const supportPhone = String(support?.phone ?? "").trim();
  const supportEmail = String(support?.email ?? "").trim();
  const supportPhoneHref = toTelHref(supportPhone);
  const supportEmailHref = toMailHref(supportEmail);
  const hasPhone = Boolean(supportPhoneHref);
  const hasEmail = Boolean(supportEmailHref);
  const hasDirectMessage = hasEmail;

  const directMessageHref = useMemo(() => {
    if (!hasEmail) return "";

    const subject = encodeURIComponent(`Support request for ${supportName}`);
    const messageBody = encodeURIComponent(message.trim());
    return `${supportEmailHref}?subject=${subject}${messageBody ? `&body=${messageBody}` : ""}`;
  }, [hasEmail, message, supportEmailHref, supportName]);

  const hasAnyChannel = hasPhone || hasEmail || hasDirectMessage;

  return (
    <div className="mx-auto w-full max-w-3xl pb-8">
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(18,22,18,0.96),rgba(11,14,11,0.98))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-7">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-lime-100">
              <Icon icon="solar:headphones-round-sound-bold-duotone" className="text-base" />
              Support
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
              Contact support quickly.
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/68 sm:text-base">
              Reach {supportName} using the fastest available option below. Only active contact methods are shown.
            </p>
          </div>
        </section>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-[1.75rem]" />
            <Skeleton className="h-24 w-full rounded-[1.75rem]" />
            <Skeleton className="h-48 w-full rounded-[1.75rem]" />
          </div>
        ) : error ? (
          <div className="rounded-[1.75rem] border border-rose-400/25 bg-rose-500/10 p-5 text-rose-100">
            <div className="flex items-start gap-3">
              <Icon icon="solar:danger-circle-bold-duotone" className="mt-0.5 text-2xl" />
              <div>
                <p className="font-semibold">Support is unavailable right now</p>
                <p className="mt-1 text-sm text-rose-100/85">{error}</p>
              </div>
            </div>
          </div>
        ) : !hasAnyChannel ? (
          <div className="rounded-[1.75rem] border border-dashed border-white/15 bg-white/5 p-6 text-sm text-white/65">
            Support contact details are not configured yet. Please try again later.
          </div>
        ) : (
          <div className="space-y-4">
            {hasPhone ? (
              <a
                href={supportPhoneHref}
                className="flex w-full items-center justify-between gap-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-5 text-left transition hover:border-lime-300/25 hover:bg-white/8"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] bg-lime-300/12 text-lime-100">
                    <Icon icon="solar:phone-calling-rounded-bold-duotone" className="text-[1.6rem]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Contact Number</p>
                    <p className="mt-2 text-lg font-semibold text-white sm:text-xl">{supportPhone}</p>
                    <p className="mt-1 text-sm text-white/60">Tap to call support directly.</p>
                  </div>
                </div>
                <Icon icon="solar:arrow-right-up-linear" className="hidden shrink-0 text-2xl text-white/35 sm:block" />
              </a>
            ) : null}

            {hasEmail ? (
              <a
                href={supportEmailHref}
                className="flex w-full items-center justify-between gap-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-5 text-left transition hover:border-lime-300/25 hover:bg-white/8"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] bg-lime-300/12 text-lime-100">
                    <Icon icon="solar:letter-bold-duotone" className="text-[1.6rem]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Email</p>
                    <p className="mt-2 break-all text-lg font-semibold text-white sm:text-xl">{supportEmail}</p>
                    <p className="mt-1 text-sm text-white/60">Tap to open your email app.</p>
                  </div>
                </div>
                <Icon icon="solar:arrow-right-up-linear" className="hidden shrink-0 text-2xl text-white/35 sm:block" />
              </a>
            ) : null}

            {hasDirectMessage ? (
              <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] bg-lime-300/12 text-lime-100">
                    <Icon icon="solar:chat-round-dots-bold-duotone" className="text-[1.6rem]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Direct Message</p>
                    <p className="mt-2 text-sm text-white/65">
                      Write your message and send it directly to {supportName}.
                    </p>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      rows={5}
                      placeholder="Describe your issue or question..."
                      className="mt-4 w-full rounded-[1.25rem] border border-white/10 bg-[#121712] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-lime-300/30"
                    />
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-white/45">
                        This opens your mail app with your message prefilled.
                      </p>
                      <a
                        href={directMessageHref}
                        className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
                          message.trim()
                            ? "bg-[#D5E400] text-[#11150f] hover:bg-[#ddea63]"
                            : "cursor-not-allowed bg-white/10 text-white/35 pointer-events-none"
                        }`}
                      >
                        <Icon icon="solar:plain-bold-duotone" className="text-base" />
                        Send message
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
