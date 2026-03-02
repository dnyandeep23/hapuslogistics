import { configureStore } from '@reduxjs/toolkit';
import counterReducer from './counterSlice';
import userReducer from './userSlice';
import packageReducer from './packageSlice';

const saveToLocalStorage = (store: any) => (next: any) => (action: any) => {

    const result = next(action);

    if (action.type.startsWith('package/')) {

        const packageState = store.getState().package;



        // Keep current in-progress image out of local storage while retaining cart image URLs.

        const stateToSave = {

            ...packageState,

            currentPackage: {

                ...packageState.currentPackage,

                packageImage: '', // Don't save image data

            },

            formData: {

                ...packageState.formData,

                // Keep package image URLs (small), so cart resumes correctly after refresh.
                cart: packageState.formData.cart,

            },

        };



        if (typeof window !== "undefined") {
            try {
                localStorage.setItem('packageState', JSON.stringify(stateToSave));
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
