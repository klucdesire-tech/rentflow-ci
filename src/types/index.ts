export interface PaymentEntry {
  status: "paid" | "unpaid";
  label: string;
  dueDate: string;
  date?: string;
  method?: string;
  amount: number;
  overdue?: boolean;
}

export interface House {
  id: string;
  address: string;
  city: string;
  type: string;
  rooms: number;
  rent: number;
  available: boolean;
}

export interface Caution {
  paid: boolean;
  amount: number;
}

export interface Advance {
  paid: boolean;
  amount: number;
  months: number;
}

export interface IdFile {
  name: string;
  data: string;
  type: string;
}

export interface Contract {
  id: string;
  houseId: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  pin: string;
  startDate: string;
  editDate: string;
  status: "active" | "closed";
  endDate?: string;
  idRecto: IdFile | null;
  idVerso: IdFile | null;
  profilePhoto: IdFile | null;
  coverPhoto: IdFile | null;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelation: string;
  caution: Caution;
  advance: Advance;
  payments: Record<string, PaymentEntry>;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface UnpaidItem {
  key: string;
  label: string;
  dueDate: string;
  overdue: boolean;
  amount: number;
  tenantName?: string;
  address?: string;
  city?: string;
  contractId?: string;
}
