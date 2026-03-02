// src/types/index.ts

export interface User {
    name: string;
    email: string;
    phone?: string;
    role: string;
    isSuperAdmin?: boolean;
    hasRegisteredBus?: boolean;
    travelCompanyId?: string;
    pendingTravelCompanyId?: string;
    buses?: string[];
    operatorApprovalStatus?:
      | 'none'
      | 'pending'
      | 'operator_requested'
      | 'company_requested'
      | 'approved'
      | 'rejected';
}

export interface RegisterCredentials {

    name: string;
    email: string;
    password: string;
    role?: 'user' | 'operator' | 'admin';
    companyName?: string;
    companyId?: string;
}

export interface LoginCredentials {
    email: string;
    password: string;
    role?: 'user' | 'operator';
    adminLogin?: boolean;
}

export interface ResetPasswordCredentials {
    email: string;
    securityCode: string;
    password: string;
}
