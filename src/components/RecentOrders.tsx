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

                setOrders(normalizedOrders);
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
                        <div key={`recent-order-skeleton-${index}`} className="overflow-hidden rounded-2xl bg-[#2A3324]">
                            <Skeleton className="h-48 w-full rounded-none" />
                            <div className="space-y-3 p-4">
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-5 w-20 rounded-full" />
                                <Skeleton className="h-4 w-32" />
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
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-[#F6FF6A]">Recent Orders</h2>
                <button
                    onClick={() => router.push('/dashboard/orders')}
                    className="text-sm font-semibold text-[#F6FF6A] hover:underline"
                >
                    View All
                </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders.map((order) => (
                    <button
                        key={order.id}
                        type="button"
                        onClick={() => router.push(`/dashboard/orders/${order.id}`)}
                        className="bg-[#2A3324] rounded-2xl overflow-hidden shadow-lg text-left transition hover:scale-[1.01]"
                    >
                        <div className="relative h-48">
                            {order.packageImage ? (
                                <Image
                                    src={order.packageImage}
                                    alt={order.packageName}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center bg-[#1E261A] text-[#CDD645]">
                                    <Icon icon="mdi:package-variant-closed" className="text-5xl" />
                                </div>
                            )}
                        </div>
                        <div className="p-4">
                            <h3 className="text-lg font-semibold text-white">{order.packageName}</h3>
                            <p className="text-sm text-gray-400">{order.date}</p>
                            <div className="mt-2">
                                <span
                                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                        order.status === 'Delivered'
                                            ? 'bg-green-500/20 text-green-400'
                                            : order.status === 'In Transit' || order.status === 'Allocated'
                                            ? 'bg-yellow-500/20 text-yellow-400'
                                            : 'bg-red-500/20 text-red-400'
                                    }`}
                                >
                                    {order.status}
                                </span>
                            </div>
                            <p className="mt-3 text-xs font-medium text-[#CDD645]">View package details</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
