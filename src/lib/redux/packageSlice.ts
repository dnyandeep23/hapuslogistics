import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';

interface PackageState {
    formData: any;
    currentPackage: any;
    editIndex: number | null;
    currentStep: number;
}

const defaultInitialState: PackageState = {
    formData: {
        pickupLocationId: '',
        dropLocationId: '',
        cart: [],
        senderName: '',
        senderContact: '',
        receiverName: '',
        receiverContact: '',
        coupon: '',
        discount: 0,
    },
    currentPackage: {
        packageName: '',
        packageType: '',
        otherPackageType: '',
        packageSize: 'Small',
        packageWeight: 0,
        packageQuantities: 1,
        pickUpDate: '',
        packageImage: '',
    },
    editIndex: null,
    currentStep: 1,
};

const getInitialState = (): PackageState => {
    if (typeof window === "undefined") {
        return defaultInitialState;
    }

    try {
        const savedState = localStorage.getItem('packageState');
        if (savedState) {
            return JSON.parse(savedState);
        }
    } catch (e) {
        console.error("Could not load state from local storage", e);
    }
    return defaultInitialState;
};


const packageSlice = createSlice({
    name: 'package',
    initialState: getInitialState(),
    reducers: {
        setFormData: (state, action: PayloadAction<any>) => {
            state.formData = action.payload;
        },
        setCurrentPackage: (state, action: PayloadAction<any>) => {
            state.currentPackage = action.payload;
        },
        setCart: (state, action: PayloadAction<any[]>) => {
            state.formData.cart = action.payload;
        },
        addToCart: (state, action: PayloadAction<any>) => {
            state.formData.cart.push(action.payload);
        },
        updateCartItem: (state, action: PayloadAction<{ index: number, item: any }>) => {
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
        resetPackageState: (state) => {
            state.formData = defaultInitialState.formData;
            state.currentPackage = defaultInitialState.currentPackage;
            state.editIndex = defaultInitialState.editIndex;
            state.currentStep = defaultInitialState.currentStep;
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
    resetPackageState,
} = packageSlice.actions;


export const selectPackage = (state: RootState) => state.package;

export default packageSlice.reducer;
