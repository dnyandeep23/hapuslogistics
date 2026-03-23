"use client";

import React, { useEffect, useMemo, useState } from "react";
import bg from "@/assets/images/addPackageBg.png";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import StepOne from "./stepOne";
import StepThree from "./stepThree";
import StepTwo from "./stepTwo";
import {
    getPickupLocations,
    getDropLocations,
    Location,
    type PricingInfo,
    createBookingSession,
    confirmAdminBooking,
    confirmBookingPayment,
    markBookingSessionFailed,
    uploadPackageImage,
} from "@/services/logistics";
import { useDispatch, useSelector } from "react-redux";
import { useToast } from "@/context/ToastContext";
import ConfirmationModal from "@/components/dashboard/ConfirmationModal";
import {
    selectPackage,
    setFormData,
    setCurrentPackage,
    setStep,
    setEditIndex,
    addToCart,
    updateCartItem,
    deleteFromCart,
    resetPackageState,
} from "@/lib/redux/packageSlice";
import { AppDispatch } from "@/lib/redux/store";
import LoadingScreen from "@/components/LoadingScreen";
import {
    DEFAULT_PACKAGE_CATEGORIES,
    DEFAULT_PACKAGE_SIZES,
    getActivePackageCategories,
    getActivePackageSizes,
    normalizePackageCategories,
    normalizePackageSizes,
    type PackageCategoryConfig,
    type PackageSizeConfig,
} from "@/lib/packageCatalog";
import { getIndiaPhoneDigits, isValidIndiaPhone } from "@/lib/phone";

export default function AddPackagePage() {
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const { addToast } = useToast();
    const packageState = useSelector(selectPackage);
    const { user, loading } = useSelector((state: any) => state.user)
    const { formData, currentPackage, editIndex, currentStep } = packageState;
    const [pickupLocations, setPickupLocations] = useState<Location[]>([]);
    const [dropLocations, setDropLocations] = useState<Location[]>([]);
    const [isLoadingPickup, setIsLoadingPickup] = useState(false);
    const [isLoadingDrop, setIsLoadingDrop] = useState(false);
    const [errors, setErrors] = useState<any>({});
    const [pricingInfo, setPricingInfo] = useState<PricingInfo | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
    const [orderData, setOrderData] = useState<any>(null);
    const [isUploadingPackageImage, setIsUploadingPackageImage] = useState(false);
    const [adminCustomerEmail, setAdminCustomerEmail] = useState("");
    const [showAdminConfirmModal, setShowAdminConfirmModal] = useState(false);
    const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
    const [packageCategories, setPackageCategories] = useState<PackageCategoryConfig[]>(
        getActivePackageCategories(DEFAULT_PACKAGE_CATEGORIES),
    );
    const [packageSizes, setPackageSizes] = useState<PackageSizeConfig[]>(
        getActivePackageSizes(DEFAULT_PACKAGE_SIZES),
    );
    const defaultPackageSizeName = useMemo(
        () => getActivePackageSizes(DEFAULT_PACKAGE_SIZES)[0]?.name || "Small",
        [],
    );
    const canProceedToPayment =
        Boolean(pricingInfo?.busId) &&
        Boolean(pricingInfo?.sessionId) &&
        Number(pricingInfo?.total) > 0;
    const isAdminBookingUser = user?.role === "admin";

    useEffect(() => {
        const fetchPickups = async () => {
            setIsLoadingPickup(true);
            const locations = await getPickupLocations();
            setPickupLocations(locations);
            setIsLoadingPickup(false);
        };
        fetchPickups();
    }, []);

    useEffect(() => {
        let active = true;
        const loadPackageCatalog = async () => {
            try {
                const response = await fetch("/api/package-catalog", { cache: "no-store" });
                const payload = await response.json();
                if (!response.ok || !active) return;

                const normalizedCategories = getActivePackageCategories(
                    normalizePackageCategories(payload?.categories, DEFAULT_PACKAGE_CATEGORIES),
                );
                const normalizedSizes = getActivePackageSizes(
                    normalizePackageSizes(payload?.sizes, DEFAULT_PACKAGE_SIZES),
                );

                if (!active) return;
                setPackageCategories(normalizedCategories);
                setPackageSizes(normalizedSizes);
            } catch {
                if (!active) return;
                setPackageCategories(getActivePackageCategories(DEFAULT_PACKAGE_CATEGORIES));
                setPackageSizes(getActivePackageSizes(DEFAULT_PACKAGE_SIZES));
            }
        };

        loadPackageCatalog();
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        // After the initial load, if there's no user, redirect to login.
        if (!loading && !user) {
            addToast("You must be logged in to create a package.", "error");
            router.push('/login');
        }
    }, [user, loading, router, addToast]);

    useEffect(() => {
        if (formData.pickupLocationId) {
            const fetchDrops = async () => {
                setIsLoadingDrop(true);
                setDropLocations([]);
                const locations = await getDropLocations(formData.pickupLocationId);
                setDropLocations(locations);
                setIsLoadingDrop(false);
            };
            fetchDrops();
        } else {
            setDropLocations([]);
        }
    }, [formData.pickupLocationId]);

    useEffect(() => {
        if (!formData.pickupLocationId) return;
        const pickupExists = pickupLocations.some((location) => location._id === formData.pickupLocationId);
        if (pickupExists) return;

        dispatch(
            setFormData({
                ...formData,
                pickupLocationId: "",
                dropLocationId: "",
            }),
        );
    }, [dispatch, formData, pickupLocations]);

    useEffect(() => {
        if (!formData.dropLocationId) return;
        const dropExists = dropLocations.some((location) => location._id === formData.dropLocationId);
        if (dropExists) return;

        dispatch(
            setFormData({
                ...formData,
                dropLocationId: "",
            }),
        );
    }, [dispatch, dropLocations, formData]);



    const getNextPackageNumber = () => {
        const numbers = formData.cart
            .map((item: any) => {
                const match = item.packageName?.match(/Package\s(\d+)/i);
                return match ? parseInt(match[1], 10) : null;
            })
            .filter((n: number | null) => n !== null);

        return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    };
    const handleFileDrop = async (file: File) => {
        setIsUploadingPackageImage(true);
        try {
            const imageUrl = await uploadPackageImage(file);
            dispatch(setCurrentPackage({ ...currentPackage, packageImage: imageUrl }));
            setErrors((prev: any) => ({ ...prev, packageImage: "" }));
        } catch (error) {
            console.error("Error uploading package image:", error);
            setErrors((prev: any) => ({ ...prev, packageImage: "Could not upload image. Please retry." }));
        } finally {
            setIsUploadingPackageImage(false);
        }
    };

    useEffect(() => {
        if (currentStep === 2 && editIndex === null && formData.cart.length > 0) {
            dispatch(setCurrentPackage({ ...currentPackage, pickUpDate: formData.cart[0].pickUpDate }));
        }
    }, [currentStep, editIndex, formData.cart, dispatch]);

    useEffect(() => {
        if (!Array.isArray(packageSizes) || packageSizes.length === 0) return;
        const currentSize = String(currentPackage?.packageSize ?? "");
        const validSize = packageSizes.some((entry) => entry.name === currentSize);
        if (validSize) return;

        dispatch(
            setCurrentPackage({
                ...currentPackage,
                packageSize: packageSizes[0].name,
            }),
        );
    }, [currentPackage, dispatch, packageSizes]);

    useEffect(() => {
        const currentType = String(currentPackage?.packageType ?? "");
        if (!currentType) return;
        const validType = packageCategories.some((entry) => entry.name === currentType);
        if (validType) return;

        dispatch(
            setCurrentPackage({
                ...currentPackage,
                packageType: "",
                otherPackageType: "",
            }),
        );
    }, [currentPackage, dispatch, packageCategories]);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [currentStep]);

    const hasUnsavedChanges = useMemo(() => {
        if (paymentStatus !== "idle") return false;
        const hasCartItems = Array.isArray(formData?.cart) && formData.cart.length > 0;
        const hasPickupDrop = Boolean(formData?.pickupLocationId || formData?.dropLocationId);
        const hasContacts = Boolean(
            String(formData?.senderName ?? "").trim() ||
            String(formData?.senderContact ?? "").trim() ||
            String(formData?.receiverName ?? "").trim() ||
            String(formData?.receiverContact ?? "").trim(),
        );
        const hasCurrentPackageDraft = Boolean(
            String(currentPackage?.packageType ?? "").trim() ||
            String(currentPackage?.otherPackageType ?? "").trim() ||
            Number(currentPackage?.packageWeight ?? 0) > 0 ||
            Number(currentPackage?.packageQuantities ?? 0) > 1 ||
            String(currentPackage?.pickUpDate ?? "").trim() ||
            String(currentPackage?.packageImage ?? "").trim(),
        );
        return hasCartItems || hasPickupDrop || hasContacts || hasCurrentPackageDraft;
    }, [currentPackage, formData, paymentStatus]);

    useEffect(() => {
        const handler = (event: BeforeUnloadEvent) => {
            if (!hasUnsavedChanges) return;
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [hasUnsavedChanges]);

    const handleExitPackagePage = () => {
        if (!hasUnsavedChanges) {
            router.back();
            return;
        }
        setShowExitConfirmModal(true);
    };

    const handleClearForm = () => {
        const defaultSize = packageSizes[0]?.name || defaultPackageSizeName;
        dispatch(setCurrentPackage({
            packageName: "",
            packageType: "",
            otherPackageType: "",
            packageSize: defaultSize,
            packageWeight: 0,
            packageQuantities: 1,
            packageImage: "",
            pickUpDate: formData.cart.length > 0 ? formData.cart[0].pickUpDate : "",
        }));
        dispatch(setEditIndex(null));
    };

    const handleEdit = (index: number) => {
        const selectedPackage = formData.cart[index];
        dispatch(setCurrentPackage(selectedPackage));
        dispatch(setEditIndex(index));
    };

    const handleDelete = (index: number) => {
        dispatch(deleteFromCart(index));
    };

    const validatePackage = (pkg: any, cart: any[], editIndex: number | null) => {
        const newErrors: any = {};
        if (!pkg.packageType) newErrors.packageType = "Package type is required.";
        const hasOtherCategory = packageCategories.some(
            (entry) => String(entry.name ?? "").trim().toLowerCase() === "other",
        );
        const isOtherCategorySelected = String(pkg.packageType ?? "").trim().toLowerCase() === "other";
        if (hasOtherCategory && isOtherCategorySelected && !pkg.otherPackageType) {
            newErrors.otherPackageType = "Please specify the package type.";
        }
        if (!pkg.packageSize) newErrors.packageSize = "Package size is required.";
        if (!pkg.packageWeight || pkg.packageWeight <= 0) newErrors.packageWeight = "Weight must be greater than 0.";
        if (!pkg.packageQuantities || pkg.packageQuantities <= 0) newErrors.packageQuantities = "Quantity must be at least 1.";
        if (!pkg.packageImage) newErrors.packageImage = "Package image is required.";
        if (!pkg.pickUpDate) newErrors.pickUpDate = "Pickup date is required.";

        if (cart.length > 0 && editIndex === null) {
            const firstPackageDate = cart[0].pickUpDate;
            if (pkg.pickUpDate !== firstPackageDate) {
                newErrors.pickUpDate = `All packages must have the same pickup date: ${firstPackageDate}.`;
            }
        }
        const sizeLimits = packageSizes.reduce<Record<string, number>>((acc, entry) => {
            acc[entry.name] = Number(entry.maxWeightKg) || 0;
            return acc;
        }, {});
        const packageSizeLabel = String(pkg.packageSize ?? "");
        const maxWeightForSize = sizeLimits[packageSizeLabel];
        if (packageSizeLabel && maxWeightForSize > 0 && pkg.packageWeight > maxWeightForSize) {
            newErrors.packageWeight = `Weight for a ${packageSizeLabel.toLowerCase()} package cannot exceed ${maxWeightForSize} kg.`;
        }
        return newErrors;
    };

    const validateStep = () => {
        const newErrors: any = {};
        if (currentStep === 1) {
            const pickupExists = pickupLocations.some((location) => location._id === formData.pickupLocationId);
            const dropExists = dropLocations.some((location) => location._id === formData.dropLocationId);

            if (!formData.pickupLocationId || !pickupExists) {
                newErrors.pickupLocationId = "Pickup location required";
            }
            if (!formData.dropLocationId || !dropExists) {
                newErrors.dropLocationId = "Drop location required";
            }
        }
        if (currentStep === 2 && formData.cart.length === 0) {
            newErrors.cart = "Please add at least one package to proceed.";
        }
        if (currentStep === 3) {
            if (!formData.senderName?.trim()) newErrors.senderName = "Sender name is required";
            if (!isValidIndiaPhone(formData.senderContact)) newErrors.senderContact = "Enter a valid Indian mobile number";
            if (!formData.receiverName?.trim()) newErrors.receiverName = "Receiver name is required";
            if (formData.senderName === formData.receiverName) newErrors.receiverName = "Sender & receiver cannot be the same person";
            if (!isValidIndiaPhone(formData.receiverContact)) newErrors.receiverContact = "Enter a valid Indian mobile number";
            if (
                getIndiaPhoneDigits(formData.senderContact) &&
                getIndiaPhoneDigits(formData.senderContact) === getIndiaPhoneDigits(formData.receiverContact)
            ) {
                newErrors.receiverContact = "Sender & receiver contact numbers cannot be the same";
            }
        }
        setErrors(newErrors);
        const errorKeys = Object.keys(newErrors);
        if (errorKeys.length > 0) {
            addToast(String(newErrors[errorKeys[0]]), "warning");
            return false;
        }
        return true;
    };

    const handleAddToCart = async () => {
        if (isUploadingPackageImage) {
            setErrors({ packageImage: "Image upload is in progress. Please wait." });
            return;
        }

        const totalQuantityInCart = formData.cart.reduce((total: number, item: any) => total + item.packageQuantities, 0);

        let newTotalQuantity;
        if (editIndex !== null) {
            // When updating, subtract the old quantity of the item being edited and add the new one
            newTotalQuantity = (totalQuantityInCart - formData.cart[editIndex].packageQuantities) + currentPackage.packageQuantities;
        } else {
            // When adding, just add the new package's quantity
            newTotalQuantity = totalQuantityInCart + currentPackage.packageQuantities;
        }

        if (newTotalQuantity > 6) {
            setErrors({ cart: "The total quantity of all packages in the cart cannot exceed 6." });
            return;
        }

        const packageErrors = validatePackage(currentPackage, formData.cart, editIndex);
        if (Object.keys(packageErrors).length > 0) {
            setErrors(packageErrors);
            return;
        }

        const finalPackageName = currentPackage.packageName?.trim() || `Package ${getNextPackageNumber()}`;

        const packageToProcess = { ...currentPackage, packageName: finalPackageName, };

        if (editIndex !== null) {
            dispatch(updateCartItem({ index: editIndex, item: packageToProcess }));
            dispatch(setEditIndex(null));
        } else {
            dispatch(addToCart(packageToProcess));
        }

        handleClearForm();
        setErrors({});
    };

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => {
                resolve(true);
            };
            script.onerror = () => {
                resolve(false);
            };
            document.body.appendChild(script);
        });
    };

    const handleSubmit = async () => {
        if (!validateStep()) {
            return;
        }

        if (!user) {
            addToast("You must be logged in to proceed.", "error");
            router.push('/login');
            return;
        }

        if (!canProceedToPayment) {
            addToast("Pricing is not ready yet. Please review package details and try again.", "error");
            return;
        }

        if (!formData.cart?.[0]?.pickUpDate) {
            addToast("Pickup date is required to continue.", "error");
            return;
        }

        if (isAdminBookingUser) {
            const normalizedCustomerEmail = String(adminCustomerEmail ?? "").trim().toLowerCase();
            if (!normalizedCustomerEmail) {
                addToast("Customer email is required for admin booking.", "error");
                return;
            }
            setShowAdminConfirmModal(true);
            return;
        }

        setPaymentStatus('processing');
        const isLoaded = await loadRazorpayScript();
        if (!isLoaded) {
            addToast("Failed to load payment gateway. Please check your connection.", 'error');
            setPaymentStatus('idle');
            return;
        }

        try {
            if (!pricingInfo?.sessionId) {
                addToast("Pricing session is not available. Please recalculate and try again.", "error");
                setPaymentStatus('idle');
                return;
            }

            const sessionPayload = {
                sessionId: pricingInfo.sessionId,
                userId: user._id,
                senderInfo: {
                    name: formData.senderName,
                    contact: formData.senderContact,
                },
                receiverInfo: {
                    name: formData.receiverName,
                    contact: formData.receiverContact,
                },
            };

            const { sessionId, razorpayOrderId, amount } = await createBookingSession(sessionPayload);

            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                amount: amount,
                currency: "INR",
                name: "Hapus Logistics",
                description: "Package Delivery Service",
                image: "/logo.png",
                order_id: razorpayOrderId,
                handler: async function (response: any) {
                    try {
                        const confirmation = await confirmBookingPayment({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });

                        setOrderData({
                            paymentId: response.razorpay_payment_id,
                            orderId: confirmation.orderId || response.razorpay_order_id,
                            trackingId: confirmation.trackingId || "Pending...",
                        });
                        setPaymentStatus('success');
                        dispatch(resetPackageState());
                        addToast("Payment successful! Your order has been confirmed.", "success");
                    } catch (confirmError: any) {
                        setPaymentStatus('failed');
                        addToast(confirmError.message || "Payment captured but confirmation failed.", "error");
                    }
                },
                prefill: {
                    name: formData.senderName,
                    contact: formData.senderContact,
                    email: user.email, // Assuming user object has email
                },
                theme: {
                    color: "#CDD645"
                },
                modal: {
                    ondismiss: async function () {
                        setPaymentStatus('failed');
                        addToast("Payment was not completed. Your hold will expire automatically.", "warning");
                    }
                }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', async (failure: any) => {
                try {
                    await markBookingSessionFailed(sessionId, {
                        reason: failure?.error?.description || "PAYMENT_FAILED",
                        razorpayOrderId,
                        razorpayPaymentId: failure?.error?.metadata?.payment_id,
                    });
                } catch (markError) {
                    console.error("Failed to mark failed payment session:", markError);
                }
                setPaymentStatus('failed');
                addToast("Payment failed. Please try again.", "error");
            });
            rzp.open();
        } catch (error: any) {
            addToast(error.message, 'error');
            setPaymentStatus('idle');
        }
    };

    const confirmAdminBookingFlow = async () => {
        if (!user || !isAdminBookingUser) return;

        setShowAdminConfirmModal(false);
        setPaymentStatus("processing");

        try {
            const confirmation = await confirmAdminBooking({
                sessionId: String(pricingInfo?.sessionId ?? ""),
                customerEmail: String(adminCustomerEmail ?? "").trim().toLowerCase(),
                senderInfo: {
                    name: formData.senderName,
                    contact: formData.senderContact,
                },
                receiverInfo: {
                    name: formData.receiverName,
                    contact: formData.receiverContact,
                },
            });

            setOrderData({
                paymentId: "MANUAL_ADMIN_BOOKING",
                orderId: confirmation.orderId,
                trackingId: confirmation.trackingId || "Pending...",
            });
            setPaymentStatus("success");
            dispatch(resetPackageState());
            setAdminCustomerEmail("");
            addToast("Order confirmed successfully without online payment.", "success");
        } catch (error: any) {
            setPaymentStatus("failed");
            addToast(error?.message || "Failed to confirm admin booking.", "error");
        }
    };

    const nextStep = () => {
        if (validateStep()) {
            dispatch(setStep(currentStep + 1));
        }
    };

    const prevStep = () => {
        dispatch(setStep(currentStep - 1));
    };

    if (loading) return <LoadingScreen />;

    return (
        <section className="relative min-h-screen overflow-hidden bg-[#21291d] text-white">
            <div className="absolute inset-0 z-0">
                <Image src={bg} alt="bg" fill className="object-cover opacity-40" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(213,228,0,0.14),transparent_32%),radial-gradient(circle_at_78%_10%,rgba(118,170,120,0.18),transparent_24%),linear-gradient(180deg,rgba(33,42,27,0.58),rgba(21,28,18,0.82)_30%,rgba(16,21,14,0.94)_100%)]" />
            </div>

            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                <div className="absolute -left-10 top-28 h-56 w-56 rounded-full bg-[#d5e400]/10 blur-3xl" />
                <div className="absolute right-0 top-16 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" />
                <div className="absolute bottom-16 left-1/3 h-48 w-48 rounded-full bg-[#f6ff6a]/8 blur-3xl" />
            </div>

            <ConfirmationModal
                isOpen={showExitConfirmModal}
                title="Leave Page?"
                description="Some saved changes might be lost if you leave this page."
                confirmLabel="Continue"
                cancelLabel="Stay Here"
                confirmVariant="warning"
                onClose={() => setShowExitConfirmModal(false)}
                onConfirm={() => {
                    setShowExitConfirmModal(false);
                    router.back();
                }}
            />

            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-12 pt-5 sm:px-6 sm:pb-16 sm:pt-6 lg:px-8">
                <button
                    type="button"
                    className="inline-flex w-fit items-center gap-3 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-semibold text-[#F4F8BF] transition hover:bg-white/10"
                    onClick={handleExitPackagePage}
                >
                    <Icon icon="famicons:arrow-back-circle-outline" fontSize={26} />
                    Back
                </button>

                <div className="mt-8 max-w-3xl">
                    <div className="package-badge inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
                        Booking Flow
                    </div>
                    <h1 className="mt-3 text-3xl font-bold text-[#F6FF6A] sm:text-4xl">
                        Add Your Package
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
                        Keep the same shipment flow, but with a cleaner gradient shell and better spacing for mobile, tablet, and desktop.
                    </p>
                </div>

                <div className="package-shell mt-8 rounded-[1.9rem] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
                    {paymentStatus === 'idle' ? (
                        <>
                            <div className="mb-8 overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-3 py-4 sm:px-5 sm:py-5">
                                <div className="flex items-start">
                                    {[
                                        { step: 1, label: "Route" },
                                        { step: 2, label: "Package" },
                                        { step: 3, label: "Review" },
                                    ].map((entry, index, list) => {
                                        const isComplete = currentStep > entry.step;
                                        const isActive = currentStep === entry.step;
                                        return (
                                            <div key={entry.step} className={`flex items-center ${index !== list.length - 1 ? "flex-1" : "flex-none"}`}>
                                                <div className="flex flex-col items-center">
                                                    <div
                                                        className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-bold transition sm:h-12 sm:w-12 ${
                                                            isComplete
                                                                ? "border-[#CDD645] bg-[#CDD645]/65 text-[#1f271a]"
                                                                : isActive
                                                                    ? "border-[#CDD645] bg-[#CDD645]/18 text-[#F6FF6A]"
                                                                    : "border-[#CDD645]/45 bg-white/6 text-white/65"
                                                        }`}
                                                    >
                                                        {isComplete ? <Icon icon="mdi:check" className="text-lg" /> : entry.step}
                                                    </div>
                                                    <p className={`mt-2 text-center text-xs font-semibold uppercase tracking-[0.14em] sm:text-sm ${
                                                        isActive || isComplete ? "text-[#F6FF6A]" : "text-white/55"
                                                    }`}>
                                                        {entry.label}
                                                    </p>
                                                </div>
                                                {index !== list.length - 1 ? (
                                                    <div className="mx-2 mb-6 h-[2px] flex-1 rounded-full bg-[#CDD645]/45 sm:mx-4" />
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                {currentStep === 1 && (
                                    <StepOne
                                        formData={formData}
                                        setFormData={(data: any) => dispatch(setFormData(data))}
                                        errors={errors}
                                        pickupLocations={pickupLocations}
                                        dropLocations={dropLocations}
                                        isLoadingPickup={isLoadingPickup}
                                        isLoadingDrop={isLoadingDrop}
                                    />
                                )}

                                {currentStep === 2 && (
                                    <StepTwo
                                        formData={formData}
                                        setFormData={(data: any) => dispatch(setFormData(data))}
                                        currentPackage={currentPackage}
                                        setCurrentPackage={(pkg: any) => dispatch(setCurrentPackage(pkg))}
                                        handleAddToCart={handleAddToCart}
                                        handleClearForm={handleClearForm}
                                        editIndex={editIndex}
                                        setEditIndex={(idx: number | null) => dispatch(setEditIndex(idx))}
                                        handleEdit={handleEdit}
                                        handleDelete={handleDelete}
                                        errors={errors}
                                        handleFileDrop={handleFileDrop}
                                        isUploadingPackageImage={isUploadingPackageImage}
                                        packageCategories={packageCategories}
                                        packageSizes={packageSizes}
                                    />
                                )}

                                {currentStep === 3 && (
                                    <StepThree
                                        errors={errors}
                                        setFormData={(data: any) => dispatch(setFormData(data))}
                                        formData={formData}
                                        pickupLocations={pickupLocations}
                                        dropLocations={dropLocations}
                                        pricingInfo={pricingInfo}
                                        setPricingInfo={setPricingInfo}
                                        userId={user?._id}
                                    />
                                )}

                                {currentStep === 3 && isAdminBookingUser && (
                                    <div className="package-panel mt-6 rounded-[1.6rem] p-4 sm:p-5">
                                        <p className="text-sm font-semibold text-[#F6FF6A]">
                                            Book On Behalf Of Customer
                                        </p>
                                        <p className="mt-1 text-xs text-white/70">
                                            Enter existing customer email. Payment will be skipped for this booking.
                                        </p>
                                        <input
                                            type="email"
                                            value={adminCustomerEmail}
                                            onChange={(event) => setAdminCustomerEmail(event.target.value)}
                                            placeholder="customer@example.com"
                                            className="package-input mt-3 w-full rounded-2xl px-3 py-3 text-sm"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-between">
                                <div>
                                    {currentStep > 1 && (
                                        <button
                                            type="button"
                                            onClick={prevStep}
                                            className="package-panel-soft flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold text-white/75 transition hover:bg-white/10 sm:w-auto"
                                        >
                                            <Icon icon={'material-symbols:arrow-back-ios-new-rounded'} /> Back
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-col gap-3 sm:flex-row">
                                    {currentStep < 3 ? (
                                        <button
                                            type="button"
                                            onClick={nextStep}
                                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#CDD645] px-5 py-3 font-semibold text-black shadow-[0_18px_36px_rgba(205,214,69,0.18)] transition hover:bg-[#dbe86b] sm:w-auto"
                                        >
                                            Next Step <Icon icon={'material-symbols:arrow-back-ios-new-rounded'} className="rotate-180" />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleSubmit}
                                            disabled={!canProceedToPayment}
                                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#CDD645] px-5 py-3 font-semibold text-black shadow-[0_18px_36px_rgba(205,214,69,0.18)] transition hover:bg-[#dbe86b] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                                        >
                                            {isAdminBookingUser ? "Confirm Booking" : "Proceed & Pay"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex min-h-[65vh] flex-col items-center justify-center space-y-6 text-center">
                            {paymentStatus === 'processing' && (
                                <>
                                    <div className="h-20 w-20 rounded-full border-4 border-[#CDD645] border-t-transparent animate-spin" />
                                    <h3 className="text-2xl font-bold text-[#F6FF6A]">
                                        {isAdminBookingUser ? "Confirming Booking..." : "Processing Payment..."}
                                    </h3>
                                    <p className="max-w-md text-white/70">
                                        {isAdminBookingUser
                                            ? "Please wait while we confirm this manual booking."
                                            : "Please wait while we confirm your payment. Do not close this window."}
                                    </p>
                                </>
                            )}

                            {paymentStatus === 'success' && orderData && (
                                <>
                                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#CDD645] text-[#2A3125]">
                                        <Icon icon="mdi:check-bold" fontSize={50} />
                                    </div>
                                    <h3 className="text-3xl font-bold text-[#F6FF6A]">
                                        {isAdminBookingUser ? "Booking Confirmed!" : "Payment Successful!"}
                                    </h3>
                                    <p className="max-w-md text-white/80">
                                        {isAdminBookingUser
                                            ? "Order has been created on behalf of the customer."
                                            : "Your package has been scheduled for pickup."}
                                    </p>

                                    <div className="package-panel w-full max-w-xl rounded-[1.6rem] p-5 sm:p-6">
                                        <div className="flex justify-between border-b border-white/10 pb-4 mb-4">
                                            <span className="text-white/60">Order ID</span>
                                            <span className="font-mono text-[#F6FF6A]">{orderData.orderId}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-white/10 pb-4 mb-4">
                                            <span className="text-white/60">Tracking ID</span>
                                            <span className="font-mono text-[#F6FF6A]">{orderData.trackingId}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-white/10 pb-4 mb-4">
                                            <span className="text-white/60">Bus Operator</span>
                                            <span className="font-bold">{orderData.busOperator}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-white/10 pb-4 mb-4">
                                            <span className="text-white/60">Bus Number</span>
                                            <span className="font-bold">{orderData.busNumber}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Estimated Arrival</span>
                                            <span className="font-bold text-green-400">{orderData.eta}</span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => router.push('/dashboard')}
                                        className="rounded-2xl bg-[#CDD645] px-8 py-3 font-semibold text-black transition hover:bg-[#e2eb55]"
                                    >
                                        Go to Dashboard
                                    </button>
                                </>
                            )}

                            {paymentStatus === 'failed' && (
                                <>
                                    <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-red-500 bg-red-500/20 text-red-500">
                                        <Icon icon="mdi:close-thick" fontSize={50} />
                                    </div>
                                    <h3 className="text-3xl font-bold text-red-400">
                                        {isAdminBookingUser ? "Booking Failed" : "Payment Failed"}
                                    </h3>
                                    <p className="max-w-md text-white/70">
                                        {isAdminBookingUser
                                            ? "Could not confirm this booking. Please retry."
                                            : "Something went wrong with the transaction. Please try again."}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        className="flex items-center gap-2 rounded-2xl bg-[#CDD645] px-8 py-3 font-semibold text-black transition hover:bg-[#e2eb55]"
                                    >
                                        <Icon icon="mdi:refresh" /> {isAdminBookingUser ? "Retry Booking" : "Retry Payment"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentStatus('idle')}
                                        className="text-sm text-white/50 underline transition hover:text-white"
                                    >
                                        Back to Review
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {showAdminConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-[#CDD645]/30 bg-[#1f271a] p-5 shadow-2xl">
                        <h3 className="text-lg font-semibold text-[#F6FF6A]">
                            Confirm Admin Booking
                        </h3>
                        <p className="mt-2 text-sm text-white/75">
                            This will confirm the order without Razorpay payment.
                        </p>
                        <div className="mt-4 space-y-2 text-sm text-white/80">
                            <p>
                                <span className="text-white/55">Customer Email:</span>{" "}
                                {String(adminCustomerEmail || "--").trim().toLowerCase()}
                            </p>
                            <p>
                                <span className="text-white/55">Total Amount:</span>{" "}
                                ₹{Number(pricingInfo?.total ?? 0).toFixed(2)}
                            </p>
                        </div>
                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowAdminConfirmModal(false)}
                                className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/75 hover:bg-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmAdminBookingFlow}
                                className="rounded-lg bg-[#CDD645] px-3 py-2 text-sm font-semibold text-black hover:bg-[#dbe86b]"
                            >
                                Confirm Booking
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
