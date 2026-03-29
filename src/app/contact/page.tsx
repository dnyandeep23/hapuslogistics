"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import ConfirmationModal from "@/components/dashboard/ConfirmationModal";
import contactVector from "@/assets/images/contactVector.png";
import { STRINGS } from "@/lib/strings";
import PublicAppShell from "@/components/PublicAppShell";
import { getIndiaPhoneDigits, isValidIndiaPhone } from "@/lib/phone";

const contactPoints = [
  {
    label: "Head Office",
    value: STRINGS.contact.address,
    href: STRINGS.contact.mapsHref,
    icon: "mdi:map-marker-outline",
  },
  {
    label: "Email",
    value: STRINGS.contact.email,
    href: `mailto:${STRINGS.contact.email}`,
    icon: "mdi:email-outline",
  },
  {
    label: "Call Us",
    value: STRINGS.contact.phone,
    href: STRINGS.contact.phoneHref,
    icon: "mdi:phone-outline",
  },
] as const;

const quickStats = [
  { label: "Response", value: "Within 1 business day" },
  { label: "Coverage", value: "Pan-India bus logistics support" },
  { label: "Support", value: "Booking, refund, and tracking help" },
] as const;

export default function ContactPage() {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<{
    name?: boolean;
    phone?: boolean;
    subject?: boolean;
    message?: boolean;
  }>({});
  const [form, setForm] = useState({
    name: "",
    phone: "",
    subject: "",
    message: "",
  });
  const errors = useMemo(() => {
    const nextErrors: {
      name?: string;
      phone?: string;
      subject?: string;
      message?: string;
    } = {};

    if (submitAttempted || touched.name) {
      if (!form.name.trim()) {
        nextErrors.name = "Name is required";
      }
    }

    if (submitAttempted || touched.phone) {
      if (!form.phone.trim() || !isValidIndiaPhone(form.phone)) {
        nextErrors.phone = "Enter a valid Indian mobile number";
      }
    }

    if (submitAttempted || touched.subject) {
      if (!form.subject.trim()) {
        nextErrors.subject = "Subject is required";
      }
    }

    if (submitAttempted || touched.message) {
      if (!form.message.trim()) {
        nextErrors.message = "Message is required";
      }
    }

    return nextErrors;
  }, [form.message, form.name, form.phone, form.subject, submitAttempted, touched.message, touched.name, touched.phone, touched.subject]);

  const isSubmitDisabled =
    !form.name.trim() ||
    !form.phone.trim() ||
    !form.subject.trim() ||
    !form.message.trim() ||
    !isValidIndiaPhone(form.phone);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setTouched({
      name: true,
      phone: true,
      subject: true,
      message: true,
    });

    if (
      !form.name.trim() ||
      !form.subject.trim() ||
      !form.message.trim() ||
      !isValidIndiaPhone(form.phone)
    ) {
      return;
    }

    setShowSuccessModal(true);
    setSubmitAttempted(false);
    setTouched({});
    setForm({
      name: "",
      phone: "",
      subject: "",
      message: "",
    });
  };

  return (
    <PublicAppShell
      className="bg-[radial-gradient(circle_at_top,rgba(213,228,0,0.16),transparent_28%),linear-gradient(180deg,#10150f_0%,#1f261b_48%,#2a3125_100%)]"
      showDock={false}
    >
      <section className="relative overflow-hidden pt-24">
        <div className="absolute inset-0">
          <Image src={contactVector} alt={`Contact ${STRINGS.brand.appName}`} fill priority className="object-cover object-center opacity-45" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,8,0.38),rgba(18,23,14,0.72)_45%,rgba(42,49,37,0.96))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(213,228,0,0.12),transparent_20%),radial-gradient(circle_at_80%_20%,rgba(140,180,90,0.12),transparent_18%)]" />
        </div>

        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-28 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl pt-10 text-center">
            <span className="inline-flex rounded-full border border-[#D5E400]/25 bg-[#D5E400]/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E4E67A]">
              Contact Us
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Connecting journeys and deliveries with care.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
              Talk to our team for booking help, shipment updates, refunds, or business partnerships. We keep the Hapus
              experience fast, simple, and dependable on every screen.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.05fr_1.35fr]">
            <aside className="dashboard-surface rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(53,62,44,0.92),rgba(34,40,28,0.98))] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold text-white sm:text-3xl">Get in touch</p>
                  <p className="mt-2 text-sm text-white/65">
                    Reach us by call, email, or visit our office. We are happy to help with shipping and support.
                  </p>
                </div>
                <div className="hidden rounded-2xl border border-[#D5E400]/20 bg-[#D5E400]/10 p-3 text-[#E4E67A] sm:flex">
                  <Icon icon="mdi:headset" className="text-2xl" />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {contactPoints.map((point) => (
                  <a
                    key={point.label}
                    href={point.href}
                    target={point.href.startsWith("http") ? "_blank" : undefined}
                    rel={point.href.startsWith("http") ? "noreferrer" : undefined}
                    className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-4 transition hover:border-[#D5E400]/30 hover:bg-black/25"
                  >
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D5E400]/25 bg-[#D5E400]/10 text-[#E4E67A]">
                      <Icon icon={point.icon} className="text-lg" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#E4E67A]">
                        {point.label}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-white/75">{point.value}</span>
                    </span>
                  </a>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Business Details</p>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  {STRINGS.brand.appName} Pvt. Ltd.
                  <br />
                  Parcel and bus logistics support for India.
                  <br />
                  Monday to Saturday, 9:30 AM to 7:00 PM.
                </p>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {quickStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{stat.label}</p>
                    <p className="mt-2 text-sm font-medium text-white">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-[#D5E400]/20 bg-[#D5E400]/10 p-4">
                <p className="text-sm font-semibold text-[#F6FF6A]">Need a quick response?</p>
                <p className="mt-1 text-sm text-white/70">
                  Call or email us directly and our support team will guide you through the next step.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={STRINGS.contact.phoneHref}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/35"
                  >
                    <Icon icon="mdi:phone-outline" className="text-base text-[#E4E67A]" />
                    Call Now
                  </a>
                  <a
                    href={`mailto:${STRINGS.contact.email}`}
                    className="inline-flex items-center gap-2 rounded-full border border-[#D5E400]/30 bg-[#D5E400]/10 px-4 py-2 text-sm font-semibold text-[#F6FF6A] transition hover:bg-[#D5E400]/20"
                  >
                    <Icon icon="mdi:email-outline" className="text-base" />
                    Email Support
                  </a>
                </div>
              </div>
            </aside>

            <div className="dashboard-surface rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(38,44,31,0.92),rgba(22,26,19,0.98))] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold text-white sm:text-3xl">Send us a Message</p>
                  <p className="mt-2 text-sm text-white/65">
                    Share your question and our team will get back to you with the right answer.
                  </p>
                </div>
                <div className="hidden rounded-2xl border border-[#D5E400]/20 bg-[#D5E400]/10 p-3 text-[#E4E67A] sm:flex">
                  <Icon icon="mdi:message-text-outline" className="text-2xl" />
                </div>
              </div>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                      Name
                    </span>
                    <input
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      onBlur={() =>
                        setTouched((prev) => ({ ...prev, name: true }))
                      }
                      placeholder="Your name"
                      className={`dashboard-input w-full rounded-2xl px-4 py-3 text-sm ${
                        errors.name ? "border-red-500/70 bg-red-500/10" : ""
                      }`}
                      required
                    />
                    <span className={`mt-2 block text-sm text-red-300 transition-all duration-300 ${errors.name ? "opacity-100" : "opacity-0"}`}>
                      {errors.name || " "}
                    </span>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                      Contact No
                    </span>
                    <div className={`flex items-center gap-2 rounded-2xl border bg-black/20 px-4 py-3 ${
                      errors.phone ? "border-red-500/70 bg-red-500/10" : "border-white/14"
                    }`}>
                      <span className="text-sm text-white/70">+91</span>
                      <input
                        value={form.phone}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            phone: getIndiaPhoneDigits(event.target.value),
                          }))
                        }
                        onBlur={() =>
                          setTouched((prev) => ({ ...prev, phone: true }))
                        }
                        placeholder="98765 43210"
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                        inputMode="numeric"
                        maxLength={10}
                        required
                      />
                    </div>
                    <span className={`mt-2 block text-sm text-red-300 transition-all duration-300 ${errors.phone ? "opacity-100" : "opacity-0"}`}>
                      {errors.phone || " "}
                    </span>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                    Subject
                  </span>
                  <input
                    value={form.subject}
                    onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                    onBlur={() =>
                      setTouched((prev) => ({ ...prev, subject: true }))
                    }
                    placeholder="Booking, refund, tracking, or business inquiry"
                    className={`dashboard-input w-full rounded-2xl px-4 py-3 text-sm ${
                      errors.subject ? "border-red-500/70 bg-red-500/10" : ""
                    }`}
                    required
                  />
                  <span className={`mt-2 block text-sm text-red-300 transition-all duration-300 ${errors.subject ? "opacity-100" : "opacity-0"}`}>
                    {errors.subject || " "}
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                    Message
                  </span>
                  <textarea
                    value={form.message}
                    onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                    onBlur={() =>
                      setTouched((prev) => ({ ...prev, message: true }))
                    }
                    placeholder="Please tell us a little about your request..."
                    rows={6}
                    maxLength={200}
                    className={`dashboard-input w-full rounded-[1.5rem] px-4 py-3 text-sm ${
                      errors.message ? "border-red-500/70 bg-red-500/10" : ""
                    }`}
                    required
                  />
                  <span className={`mt-2 block text-sm text-red-300 transition-all duration-300 ${errors.message ? "opacity-100" : "opacity-0"}`}>
                    {errors.message || " "}
                  </span>
                  <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/45">
                    <span>Message limit</span>
                    <span>{form.message.length}/200</span>
                  </div>
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-white/60">
                    By submitting, you agree to be contacted by our support team for this request.
                  </p>
                  <button
                    type="submit"
                    disabled={isSubmitDisabled}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D5E400]/30 bg-[#D5E400]/12 px-5 py-3 text-sm font-semibold text-[#F6FF6A] transition hover:bg-[#D5E400]/20"
                  >
                    <Icon icon="mdi:send-outline" className="text-base" />
                    Submit
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#11160f]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3">
          <a
            href={STRINGS.contact.phoneHref}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white"
          >
            <Icon icon="mdi:phone-outline" className="text-base text-[#E4E67A]" />
            Call
          </a>
          <a
            href={`mailto:${STRINGS.contact.email}`}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#D5E400]/25 bg-[#D5E400]/12 px-4 py-3 text-sm font-semibold text-[#F6FF6A]"
          >
            <Icon icon="mdi:email-outline" className="text-base" />
            Email
          </a>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showSuccessModal}
        title="Message Sent"
        description="Thanks for reaching out. Our support team will get back to you shortly."
        confirmLabel="Close"
        hideCancel
        confirmVariant="success"
        onClose={() => setShowSuccessModal(false)}
        onConfirm={() => setShowSuccessModal(false)}
      />
    </PublicAppShell>
  );
}
