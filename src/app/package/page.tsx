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
    createBookingSession,
    confirmAdminBooking,
    confirmBookingPayment,
    markBookingSessionFailed,
    uploadPackageImage,
} from "@/services/logistics";
import { useDispatch, useSelector } from "react-redux";
import { useToast } from "@/context/ToastContext";
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
    const [pricingInfo, setPricingInfo] = useState<any>(null);
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
    const [orderData, setOrderData] = useState<any>(null);
    const [isUploadingPackageImage, setIsUploadingPackageImage] = useState(false);
    const [adminCustomerEmail, setAdminCustomerEmail] = useState("");
    const [showAdminConfirmModal, setShowAdminConfirmModal] = useState(false);
    const canProceedToPayment =
        Boolean(pricingInfo?.busId) &&
        Boolean(pricingInfo?.sessionId) &&
        Number(pricingInfo?.total) > 0;
    const isAdminBookingUser = Boolean(user?.role === "admin" || user?.isSuperAdmin);

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
        const shouldLeave = window.confirm(
            "Some saved changes might be lost if you leave this page. Continue?",
        );
        if (shouldLeave) {
            router.back();
        }
    };

    const handleClearForm = () => {
        dispatch(setCurrentPackage({
            packageName: "",
            packageType: "",
            otherPackageType: "",
            packageSize: "Small",
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
        if (pkg.packageType === "Other" && !pkg.otherPackageType) newErrors.otherPackageType = "Please specify the package type.";
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
        const sizeLimits: { [key: string]: number } = { "Small": 5, "Medium": 10, "Large": 20 };
        if (pkg.packageSize && pkg.packageWeight > sizeLimits[pkg.packageSize]) {
            newErrors.packageWeight = `Weight for a ${pkg.packageSize.toLowerCase()} package cannot exceed ${sizeLimits[pkg.packageSize]} kg.`;
        }
        return newErrors;
    };

    const validateStep = () => {
        const newErrors: any = {};
        if (currentStep === 1) {
            if (!formData.pickupLocationId) newErrors.pickupLocationId = "Pickup location required";
            if (!formData.dropLocationId) newErrors.dropLocationId = "Drop location required";
        }
        if (currentStep === 2 && formData.cart.length === 0) {
            newErrors.cart = "Please add at least one package to proceed.";
        }
        if (currentStep === 3) {
            if (!formData.senderName?.trim()) newErrors.senderName = "Sender name is required";
            if (!/^\d{10}$/.test(formData.senderContact)) newErrors.senderContact = "Sender contact must be 10 digits";
            if (!formData.receiverName?.trim()) newErrors.receiverName = "Receiver name is required";
            if (formData.senderName === formData.receiverName) newErrors.receiverName = "Sender & receiver cannot be the same person";
            if (!/^\d{10}$/.test(formData.receiverContact)) newErrors.receiverContact = "Receiver contact must be 10 digits";
            if (formData.senderContact === formData.receiverContact) newErrors.receiverContact = "Sender & receiver contact numbers cannot be the same";
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
        <section>
            <div className="relative min-h-screen overflow-hidden bg-[#2A3125]">

                <div className="absolute top-0 left-0 h-screen w-full z-0">
                    <Image src={bg} alt="bg" fill className="object-cover" />
                    <div className="absolute inset-0 bg-linear-to-b from-[#819772]/20 to-[#2A3125]" />
                </div>


                {/* Header */}
                <div
                    className="absolute top-4 left-4 flex items-center gap-3 text-xl font-bold text-[#162D01] cursor-pointer z-20"
                    onClick={handleExitPackagePage}
                >
                    <Icon icon="famicons:arrow-back-circle-outline" fontSize={32} />
                    Add Your Package
                </div>

                {/* FORM CONTAINER */}
                <div className="relative z-10 mt-44 mb-12 flex justify-center items-center min-h-screen px-4">
                    <div className="w-full max-w-6xl bg-[#3E4936]/70 rounded-2xl py-6 px-22 md:py-12 text-white shadow-xl">
                        {paymentStatus === 'idle' ? (
                            <>
                                {/* Step Indicator */}
                                <div className="flex items-center mb-12 w-full">
                                    {[1, 2, 3].map((num) => (
                                        <div key={num} className={`flex items-center ${num !== 3 ? "flex-1" : "flex-none"}`}>
                                            <div className={`w-15 h-15 rounded-full flex items-center justify-center border-2 border-[#CDD645] ${currentStep > num ? "bg-[#CDD645]/70" : currentStep === num ? "bg-[#CDD6D45]/50" : "bg-[#CDD645]/20"}`}>
                                                {currentStep > num ? <Icon icon="mdi:check" fontSize={35} className="text-white text-lg font-extrabold" /> : <span className="text-[#fcffcb] text-lg font-bold">{num}</span>}
                                            </div>
                                            {num !== 3 && <div className="flex-1 h-0.5 bg-[#CDD645]" />}
                                        </div>
                                    ))}
                                </div>

                                <div>
                                    {/* Steps */}
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
                                        />
                                    )}

                                    {currentStep === 3 && <StepThree errors={errors} setFormData={(data: any) => dispatch(setFormData(data))} formData={formData} pickupLocations={pickupLocations} dropLocations={dropLocations} pricingInfo={pricingInfo} setPricingInfo={setPricingInfo} userId={user?._id} />}

                                    {currentStep === 3 && isAdminBookingUser && (
                                        <div className="mt-6 rounded-xl border border-[#CDD645]/35 bg-[#1e241b]/70 p-4">
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
                                                className="mt-3 w-full rounded-lg border border-white/20 bg-black/35 px-3 py-2 text-sm text-white outline-none transition focus:border-[#CDD645]/65"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Buttons */}
                                <div className="place-self-end flex gap-3  justify-between mt-16 mb-8">
                                    {currentStep > 1 && (
                                        <button
                                            onClick={prevStep}
                                            className="py-3 w-64 hover:bg-[#979646]/40 border rounded-lg border-[#979646] bg-[#979646]/20 font-bold flex gap-2 justify-center items-center text-white/60 cursor-pointer"
                                        >
                                            <Icon icon={'material-symbols:arrow-back-ios-new-rounded'} />  Back
                                        </button>
                                    )}

                                    {currentStep < 3 ? (
                                        <button
                                            onClick={nextStep}
                                            className="  py-3 w-64 justify-center rounded-lg hover:bg-[#CDD645] opacity-85 hover:opacity-100 hover:shadow-2xl shadow-lime-500/60  font-bold flex gap-2 items-center text-black/60 cursor-pointer bg-[#979646] "
                                        >
                                            Next Step <Icon icon={'material-symbols:arrow-back-ios-new-rounded'} className="rotate-180" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleSubmit}
                                            disabled={!canProceedToPayment}
                                            className="py-3 w-64 justify-center rounded-lg hover:bg-[#CDD645] opacity-85 hover:opacity-100 hover:shadow-2xl shadow-lime-500/60 font-bold flex gap-2 items-center text-black/60 cursor-pointer bg-[#979646] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#979646]">
                                            {isAdminBookingUser ? "Confirm Booking" : "Proceed & Pay"}
                                        </button>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center min-h-125 text-center space-y-6">
                                {paymentStatus === 'processing' && (
                                    <>
                                        <div className="w-20 h-20 border-4 border-[#CDD645] border-t-transparent rounded-full animate-spin"></div>
                                        <h3 className="text-2xl font-bold text-[#F6FF6A]">
                                            {isAdminBookingUser ? "Confirming Booking..." : "Processing Payment..."}
                                        </h3>
                                        <p className="text-white/70">
                                            {isAdminBookingUser
                                                ? "Please wait while we confirm this manual booking."
                                                : "Please wait while we confirm your payment. Do not close this window."}
                                        </p>
                                    </>
                                )}

                                {paymentStatus === 'success' && orderData && (
                                    <>
                                        <div className="w-24 h-24 bg-[#CDD645] rounded-full flex items-center justify-center text-[#2A3125]">
                                            <Icon icon="mdi:check-bold" fontSize={50} />
                                        </div>
                                        <h3 className="text-3xl font-bold text-[#F6FF6A]">
                                            {isAdminBookingUser ? "Booking Confirmed!" : "Payment Successful!"}
                                        </h3>
                                        <p className="text-white/80">
                                            {isAdminBookingUser
                                                ? "Order has been created on behalf of the customer."
                                                : "Your package has been scheduled for pickup."}
                                        </p>

                                        <div className="bg-[#1e241b] p-6 rounded-xl w-full max-w-lg mt-6 border border-[#CDD645]/30">
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
                                            onClick={() => router.push('/dashboard')}
                                            className="mt-8 py-3 px-8 rounded-lg bg-[#CDD645] font-bold text-black hover:bg-[#e2eb55] transition"
                                        >
                                            Go to Dashboard
                                        </button>
                                    </>
                                )}

                                {paymentStatus === 'failed' && (
                                    <>
                                        <div className="w-24 h-24 bg-red-500/20 border-2 border-red-500 rounded-full flex items-center justify-center text-red-500">
                                            <Icon icon="mdi:close-thick" fontSize={50} />
                                        </div>
                                        <h3 className="text-3xl font-bold text-red-400">
                                            {isAdminBookingUser ? "Booking Failed" : "Payment Failed"}
                                        </h3>
                                        <p className="text-white/70">
                                            {isAdminBookingUser
                                                ? "Could not confirm this booking. Please retry."
                                                : "Something went wrong with the transaction. Please try again."}
                                        </p>
                                        <button
                                            onClick={handleSubmit}
                                            className="mt-6 py-3 px-8 rounded-lg bg-[#CDD645] font-bold text-black hover:bg-[#e2eb55] transition flex items-center gap-2"
                                        >
                                            <Icon icon="mdi:refresh" /> {isAdminBookingUser ? "Retry Booking" : "Retry Payment"}
                                        </button>
                                        <button
                                            onClick={() => setPaymentStatus('idle')}
                                            className="mt-2 text-white/50 hover:text-white text-sm underline"
                                        >
                                            Back to Review
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
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
