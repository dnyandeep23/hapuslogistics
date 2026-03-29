import PublicAppShell from "@/components/PublicAppShell";

const values = [
  {
    title: "Reliable movement",
    text: "We help travellers and businesses move parcels with dependable timing and clear coordination.",
  },
  {
    title: "Operational clarity",
    text: "The Hapus platform is designed so admins, operators, and customers can see what matters quickly.",
  },
  {
    title: "Transparent support",
    text: "Pricing, refund handling, and contact paths should feel understandable before and after booking.",
  },
];

export default function AboutPage() {
  return (
    <PublicAppShell className="bg-[radial-gradient(circle_at_top,rgba(205,214,69,0.14),transparent_28%),linear-gradient(180deg,#10150f_0%,#1b2218_48%,#0d110b_100%)]">
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-24 sm:px-6 sm:pb-14 lg:px-8 lg:pt-28">
        <div className="dashboard-surface rounded-[2rem] p-6 sm:p-8">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-[#CDD645]/30 bg-[#CDD645]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F6FF6A]">
              About Hapus
            </span>
            <h1 className="mt-4 text-3xl font-bold text-white sm:text-5xl">
              Built to make bus-linked logistics feel more modern
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/72 sm:text-base">
              Hapus Logistics focuses on practical parcel movement: simple booking, route-aware handling, tracking
              clarity, and easier communication between customers, operators, and business teams.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {values.map((value) => (
              <article key={value.title} className="dashboard-surface-soft rounded-2xl p-5">
                <h2 className="text-lg font-semibold text-[#F6FF6A]">{value.title}</h2>
                <p className="mt-3 text-sm leading-7 text-white/75">{value.text}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/15 p-5">
            <h2 className="text-lg font-semibold text-[#F6FF6A]">What we care about</h2>
            <p className="mt-3 text-sm leading-7 text-white/75">
              We want the public site to feel as dependable as the service itself: clear booking steps, easy policy
              access, better mobile readability, and a support path that customers can trust during real deliveries.
            </p>
          </div>
        </div>
      </section>
    </PublicAppShell>
  );
}
