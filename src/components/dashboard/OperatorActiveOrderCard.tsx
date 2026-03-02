"use client";

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import Skeleton from "@/components/Skeleton";

export type OperatorActiveOrder = {
  id: string;
  trackingId: string;
  status: string;
  orderDate: string;
  pickupLocation: {
    name: string;
    city: string;
    state: string;
  };
  dropLocation: {
    name: string;
    city: string;
    state: string;
  };
  pickupProofImage?: string;
  dropProofImage?: string;
  operatorNote?: string;
  sender: {
    name: string;
    phone: string;
  };
  receiver: {
    name: string;
    phone: string;
  };
  bus: {
    id: string;
    busName: string;
    busNumber: string;
    busImage: string;
    operatorName: string;
    operatorPhone: string;
  };
};

type Props = {
  orders: OperatorActiveOrder[];
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
};

const getStatusBadge = (status: string): string => {
  const normalized = status.toLowerCase();
  if (normalized === "delivered") return "bg-green-500/20 text-green-300 border-green-500/40";
  if (normalized === "in-transit") return "bg-blue-500/20 text-blue-300 border-blue-500/40";
  if (normalized === "cancelled") return "bg-red-500/20 text-red-300 border-red-500/40";
  return "bg-amber-500/20 text-amber-300 border-amber-500/40";
};

const toDialablePhone = (value: string | undefined) =>
  String(value ?? "").trim().replace(/[^\d+]/g, "");

export default function OperatorActiveOrderCard({
  orders,
  loading,
  error,
  onRefresh,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredOrders = useMemo(() => {
    if (!normalizedSearchQuery) return orders;

    return orders.filter((order) => {
      const searchableText = [order.trackingId, order.sender?.name, order.receiver?.name]
        .map((value) => String(value ?? "").trim())
        .join(" ")
        .toLowerCase();
      return searchableText.includes(normalizedSearchQuery);
    });
  }, [normalizedSearchQuery, orders]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-[#4e573f] bg-[#1f251c] p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[#E4E67A]">Active Orders</h2>
            <p className="text-xs text-white/55">Showing all active packages assigned to you.</p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon icon="mdi:refresh" className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`operator-active-order-skeleton-${index}`}
                className="rounded-xl border border-white/15 bg-black/25 p-3"
              >
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-52" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-8 w-28" />
                    <Skeleton className="h-8 w-28" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-white/15 bg-black/25 p-4 text-sm text-white/70">
            No active order is assigned for your current bus period.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/15 bg-black/25 p-3">
              <label className="mb-2 block text-xs uppercase tracking-wide text-white/50">Search Active Orders</label>
              <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-black/35 px-3 py-2">
                <Icon icon="mdi:magnify" className="text-lg text-white/60" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search tracking ID, sender name, receiver name..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/45"
                />
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="rounded-xl border border-white/15 bg-black/25 p-4 text-sm text-white/70">
                No active orders matched <span className="font-medium text-white">{searchQuery}</span>.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOrders.map((order) => {
                  const senderPhoneLink = toDialablePhone(order.sender?.phone);
                  const receiverPhoneLink = toDialablePhone(order.receiver?.phone);

                  return (
                    <article
                      key={order.id}
                      className="rounded-xl border border-white/15 bg-black/25 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="font-mono text-sm text-[#E4E67A]">{order.trackingId}</p>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${getStatusBadge(order.status)}`}
                        >
                          {order.status}
                        </span>
                      </div>

                      <p className="text-xs text-white/70">
                        {order.pickupLocation.name} to {order.dropLocation.name}
                      </p>
                      <p className="mt-1 text-[11px] text-white/55">
                        Sender: {order.sender?.name || "--"} | Receiver: {order.receiver?.name || "--"}
                      </p>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {senderPhoneLink ? (
                          <a
                            href={`tel:${senderPhoneLink}`}
                            className="inline-flex items-center justify-center gap-1 rounded-md border border-green-500/60 bg-green-500/10 px-2 py-1.5 text-xs font-medium text-green-300 hover:bg-green-500/20"
                          >
                            <Icon icon="mdi:phone" className="text-sm" />
                            Call Sender
                          </a>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-1 rounded-md border border-white/20 px-2 py-1.5 text-xs text-white/50">
                            <Icon icon="mdi:phone-off" className="text-sm" />
                            Sender N/A
                          </span>
                        )}

                        {receiverPhoneLink ? (
                          <a
                            href={`tel:${receiverPhoneLink}`}
                            className="inline-flex items-center justify-center gap-1 rounded-md border border-red-500/60 bg-red-500/10 px-2 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20"
                          >
                            <Icon icon="mdi:phone" className="text-sm" />
                            Call Receiver
                          </a>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-1 rounded-md border border-white/20 px-2 py-1.5 text-xs text-white/50">
                            <Icon icon="mdi:phone-off" className="text-sm" />
                            Receiver N/A
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
