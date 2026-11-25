export type Role = "customer" | "admin";

export function canReadAppointment(
  role: Role,
  ownerProfileId: string | null,
  userId: string,
): boolean {
  if (role === "admin") return true;
  return ownerProfileId !== null && ownerProfileId === userId;
}

export function canManageSalon(role: Role): boolean {
  return role === "admin";
}

export function canCustomerModify(startsAt: Date, now: Date, minHours: number): boolean {
  return startsAt.getTime() - now.getTime() >= minHours * 3_600_000;
}

export function assertRoleUnchanged(current: Role, requested: Role | undefined): Role {
  if (requested && requested !== current) {
    throw new Error("Non è consentito modificare il proprio ruolo.");
  }
  return current;
}
