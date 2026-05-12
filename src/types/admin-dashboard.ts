// Admin Dashboard TypeScript Interfaces

export type OperationType = 'user' | 'content' | 'transaction' | 'system' | 'ai';

export interface OperationLog {
  id: string;
  operatorId: string;
  operatorName: string;
  operationType: OperationType;
  operationDescription: string;
  targetType?: string;
  targetId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface ProducerInvitation {
  id: string;
  inviteeName: string;
  inviteeEmail: string;
  expertiseTags: string[];
  revenueShare: number;
  expiryDays: number;
  personalNote?: string;
  status: InvitationStatus;
  invitedBy: string;
  acceptedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type SettlementStatus = 'processing' | 'paid';

export interface Settlement {
  id: string;
  settlementNumber: string;
  producerId: string;
  producerName: string;
  templateSalesAmount: number;
  platformCommission: number;
  settlementAmount: number;
  status: SettlementStatus;
  settlementDate: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformSettings {
  basic: {
    platformName: string;
    platformDescription: string;
    contactEmail: string;
    icpNumber: string;
  };
  transaction: {
    commissionRate: number;
    minWithdrawalAmount: number;
    settlementCycleDays: number;
    enabledPaymentMethods: string[];
  };
  aiGeneration: {
    modelVersion: string;
    maxConcurrentGenerations: number;
    generationTimeoutSeconds: number;
    creditsResetSchedule: string;
  };
  review: {
    trustedProducerAutoApprove: boolean;
    aiContentSafetyPreCheck: boolean;
    reviewTimeoutReminderHours: number;
    notificationMethods: string[];
  };
}

// Dashboard aggregated stats
export interface DashboardStats {
  totalUsers: number;
  monthlyRevenue: number;
  totalTemplates: number;
  monthlyCreditsConsumed: number;
  recentOrders: DashboardOrder[];
  membershipDistribution: { tier: string; count: number; percentage: number }[];
  topTemplates: { name: string; category: string; price: number; salesCount: number }[];
  recentActivity: { type: string; description: string; time: Date }[];
}

export interface DashboardOrder {
  orderNumber: string;
  userName: string;
  templateName: string;
  amount: number;
  status: string;
  createdAt: Date;
}

// Paginated response wrapper
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
