"use client";

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks';
import { fetchUser } from '@/lib/redux/userSlice';
import { usePathname } from 'next/navigation';

export default function UserProvider({ children }: { children: React.ReactNode }) {
    const dispatch = useAppDispatch();
    const pathname = usePathname();
    const { user, loading, reason } = useAppSelector((state) => state.user);

    useEffect(() => {
        const shouldStopRetry =
            reason === "NO_TOKEN" ||
            reason === "USER_NOT_FOUND" ||
            reason === "TOKEN_INVALID" ||
            reason === "LOGGED_OUT";

        if (!user && !loading && pathname.startsWith('/dashboard') && !shouldStopRetry) {
            dispatch(fetchUser());
        }
    }, [dispatch, user, loading, pathname, reason]);

    return <>{children}</>;
}
