"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import { useToast } from '@/context/ToastContext';
import Skeleton from '@/components/Skeleton';

interface Order {
    id: string;
    packageName: string;
    status: string;
    date: string;
    packageImage?: string;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown, fallback = ''): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return String(value);
    if (value && typeof value === 'object') {
        const maybeHex = (value as { toHexString?: () => string }).toHexString;
        if (typeof maybeHex === 'function') {
            const hex = maybeHex.call(value);
            if (hex) return hex;
        }
        const maybeToString = (value as { toString?: () => string }).toString;
        if (typeof maybeToString === 'function') {
            const stringified = maybeToString.call(value);
            if (stringified && stringified !== '[object Object]') return stringified;
        }
    }
    return fallback;
}

function titleCase(value: string): string {
    return value
        .split(/[\s-_]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function getStatusTone(status: string) {
    const normalized = status.toLowerCase();
    if (normalized === 'delivered') {
        return {
            icon: 'mdi:check-circle-outline',
            badge: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25',
            accent: 'from-emerald-500/18 to-emerald-500/0',
        };
    }

    if (normalized === 'in transit' || normalized === 'in-transit' || normalized === 'allocated') {
        return {
            icon: 'mdi:truck-fast-outline',
            badge: 'bg-amber-500/15 text-amber-300 ring-amber-500/25',
            accent: 'from-amber-500/18 to-amber-500/0',
        };
    }

    if (normalized === 'missed package' || normalized === 'missed_package') {
        return {
            icon: 'mdi:package-variant-remove',
            badge: 'bg-orange-500/15 text-orange-200 ring-orange-500/25',
            accent: 'from-orange-500/18 to-orange-500/0',
        };
    }

    return {
        icon: 'mdi:clock-outline',
        badge: 'bg-rose-500/15 text-rose-300 ring-rose-500/25',
        accent: 'from-rose-500/18 to-rose-500/0',
    };
}

function mapOrder(raw: unknown): Order | null {
    if (!isRecord(raw)) return null;

    const packageNamesRaw = raw.packageNames;
    const packageNames =
        Array.isArray(packageNamesRaw)
            ? packageNamesRaw.map((name) => toStringValue(name)).filter(Boolean)
            : [];

    const id = toStringValue(raw.id || raw._id);
    if (!id) return null;

    const packageName =
        toStringValue(raw.packageName) ||
        packageNames[0] ||
        'Package';

    const status = titleCase(toStringValue(raw.status, 'Pending'));
    const dateRaw = toStringValue(raw.date) || toStringValue(raw.orderDate) || toStringValue(raw.createdAt);
    const date = dateRaw ? new Date(dateRaw).toLocaleDateString('en-IN') : '--';

    return {
        id,
        packageName,
        status,
        date,
        packageImage: toStringValue(raw.packageImage) || undefined,
    };
}

export default function RecentOrders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { addToast } = useToast();

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await fetch('/api/recent-orders');
                const data = await response.json();
                if (!response.ok) {
                    if (response.status === 401) {
                        addToast('Please login to view recent orders.', 'warning');
                    } else {
                        addToast(data?.error || 'Could not load recent orders right now.', 'error');
                    }
                    setOrders([]);
                    return;
                }

                const normalizedOrders = Array.isArray(data)
                    ? data.map(mapOrder).filter((order): order is Order => Boolean(order))
                    : [];

                setOrders(normalizedOrders.slice(0, 3));
            } catch (error) {
                console.error('Error fetching recent orders:', error);
                addToast('Network issue while loading recent orders.', 'error');
                setOrders([]);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [addToast]);

    if (loading) {
        return (
            <div className="mt-12">
                <div className="mb-6 flex items-center justify-between">
                    <Skeleton className="h-8 w-40" />
                    <Skeleton className="h-5 w-20" />
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div
                            key={`recent-order-skeleton-${index}`}
                            className="overflow-hidden rounded-3xl border border-[#4e573f] bg-[#1f251c]"
                        >
                            <Skeleton className="h-44 w-full rounded-none" />
                            <div className="space-y-3 p-4">
                                <Skeleton className="h-4 w-24 rounded-full" />
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                    <Skeleton className="h-4 w-16" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (orders.length === 0) {
        return null;
    }

    return (
        <div className="mt-12">
            <div className="mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#F6FF6A]/20 bg-[#F6FF6A]/10 text-[#F6FF6A]">
                        <Icon icon="mdi:receipt-text-outline" className="text-xl" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight text-[#F6FF6A] sm:text-2xl">Recent Orders</h2>
                        <p className="text-sm text-white/60">Quick scan of your latest shipments.</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        const tracker = document.getElementById("dashboard-order-tracker");
                        if (tracker) {
                            tracker.scrollIntoView({ behavior: "smooth", block: "start" });
                        } else {
                            router.push('/dashboard/orders');
                        }
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-[#F6FF6A]/20 bg-[#F6FF6A]/10 px-4 py-2 text-sm font-semibold text-[#F6FF6A] transition-colors hover:bg-[#F6FF6A]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6FF6A]/50"
                >
                    View More
                    <Icon icon="mdi:arrow-down" className="text-base" />
                </button>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {orders.map((order) => (
                    <button
                        key={order.id}
                        type="button"
                        onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                        className="group overflow-hidden rounded-3xl border border-[#4e573f] bg-[#1f251c] text-left shadow-[0_18px_40px_-30px_rgba(0,0,0,0.8)] transition-all duration-300 hover:-translate-y-1 hover:border-[#F6FF6A]/20 hover:shadow-[0_24px_50px_-30px_rgba(246,255,106,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6FF6A]/50"
                        aria-label={`Open order ${order.packageName}`}
                    >
                        <div className="relative h-44 overflow-hidden">
                            {order.packageImage ? (
                                <Image
                                    src={order.packageImage}
                                    alt={order.packageName}
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                            ) : (
                                <div className={`flex h-full items-center justify-center bg-gradient-to-br from-[#1E261A] to-[#2A3324] text-[#CDD645]`}>
                                    <Icon icon="mdi:package-variant-closed" className="text-5xl opacity-90" />
                                </div>
                            )}
                            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${getStatusTone(order.status).accent} via-transparent to-transparent`} />
                            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/85 backdrop-blur">
                                <Icon icon={getStatusTone(order.status).icon} className="text-sm text-[#F6FF6A]" />
                                {order.status}
                            </div>
                        </div>
                        <div className="space-y-4 p-4">
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold leading-snug text-white">{order.packageName}</h3>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/60">
                                    <span className="inline-flex items-center gap-1.5">
                                        <Icon icon="mdi:calendar-blank-outline" className="text-base" />
                                        {order.date}
                                    </span>
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusTone(order.status).badge}`}>
                                        <Icon icon={getStatusTone(order.status).icon} className="text-sm" />
                                        {order.status}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs font-semibold text-[#CDD645]">
                                <span className="inline-flex items-center gap-1.5">
                                    View package details
                                </span>
                                <Icon icon="mdi:chevron-right" className="text-base transition-transform group-hover:translate-x-0.5" />
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
