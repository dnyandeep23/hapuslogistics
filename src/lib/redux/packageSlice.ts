import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';
import type { CartItem, PackageDraft, PackageFormData, PackageState } from '@/app/package/types';
import { createDefaultPackageState, loadPackageStateFromStorage } from '@/app/package/state';

const getInitialState = (): PackageState => loadPackageStateFromStorage();

const packageSlice = createSlice({
    name: 'package',
    initialState: getInitialState(),
    reducers: {
        setFormData: (state, action: PayloadAction<PackageFormData>) => {
            state.formData = action.payload;
        },
        setCurrentPackage: (state, action: PayloadAction<PackageDraft>) => {
            state.currentPackage = action.payload;
        },
        setCart: (state, action: PayloadAction<CartItem[]>) => {
            state.formData.cart = action.payload;
        },
        addToCart: (state, action: PayloadAction<CartItem>) => {
            state.formData.cart.push(action.payload);
        },
        updateCartItem: (state, action: PayloadAction<{ index: number, item: CartItem }>) => {
            state.formData.cart[action.payload.index] = action.payload.item;
        },
        deleteFromCart: (state, action: PayloadAction<number>) => {
            state.formData.cart.splice(action.payload, 1);
        },
        clearCart: (state) => {
            state.formData.cart = [];
        },
        setStep: (state, action: PayloadAction<number>) => {
            state.currentStep = action.payload;
        },
        setEditIndex: (state, action: PayloadAction<number | null>) => {
            state.editIndex = action.payload;
        },
        replacePackageState: (state, action: PayloadAction<PackageState>) => {
            state.formData = action.payload.formData;
            state.currentPackage = action.payload.currentPackage;
            state.editIndex = action.payload.editIndex;
            state.currentStep = action.payload.currentStep;
            state.recoveryNotice = action.payload.recoveryNotice;
        },
        clearPackageRecoveryNotice: (state) => {
            state.recoveryNotice = null;
        },
        resetPackageState: (state) => {
            const defaultState = createDefaultPackageState();
            state.formData = defaultState.formData;
            state.currentPackage = defaultState.currentPackage;
            state.editIndex = defaultState.editIndex;
            state.currentStep = defaultState.currentStep;
            state.recoveryNotice = defaultState.recoveryNotice;
        },
    },
});

export const {
    setFormData,
    setCurrentPackage,
    setCart,
    addToCart,
    updateCartItem,
    deleteFromCart,
    clearCart,
    setStep,
    setEditIndex,
    replacePackageState,
    clearPackageRecoveryNotice,
    resetPackageState,
} = packageSlice.actions;


export const selectPackage = (state: RootState) => state.package;

export default packageSlice.reducer;
