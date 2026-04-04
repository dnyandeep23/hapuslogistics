import { configureStore, type Middleware, type UnknownAction } from '@reduxjs/toolkit';
import counterReducer from './counterSlice';
import userReducer from './userSlice';
import packageReducer from './packageSlice';
import { createPersistablePackageState, PACKAGE_STORAGE_KEY } from '@/app/package/state';
import type { PackageState } from '@/app/package/types';

const saveToLocalStorage: Middleware = (storeApi) => (next) => (action) => {

    const result = next(action as UnknownAction);

    if (typeof action === "object" && action !== null && "type" in action && typeof action.type === "string" && action.type.startsWith('package/')) {

        const packageState = (storeApi.getState() as RootState).package as PackageState;
        const stateToSave = createPersistablePackageState(packageState);



        if (typeof window !== "undefined") {
            try {
                localStorage.setItem(PACKAGE_STORAGE_KEY, JSON.stringify(stateToSave));
            } catch (e) {
                console.error("Could not save state to local storage", e);
            }
        }

    }

    return result;

};


export const store = configureStore({
    reducer: {
        counter: counterReducer,
        user: userReducer,
        package: packageReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(saveToLocalStorage),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
