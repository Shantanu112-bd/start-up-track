import { UserRole, UserStatus } from "./enums";

export interface User {
  id: string;
  email: string | null;
  emailNormalized: string | null;
  phoneE164: string | null;
  displayName: string | null;
  role: UserRole;
  status: UserStatus;
  referralCode: string | null;
  lastLoginAt: Date | string | null;
  metadata: any;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
  kycStatus?: string;
}
