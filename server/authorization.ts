/**
 * V3 server-side authorization core (not wired to the public demo).
 * Call only after the server has VERIFIED the session and loaded current
 * memberships and ownership from its trusted database.
 * Never trust role, ownerId or grant data supplied by a browser request.
 */
export type Actor = { userId: string; role: "platform_admin" | "agency_manager" | "agent"; active: boolean; organizationId: string };
export type Customer = { id: string; ownerUserId: string; organizationId: string };
export type MedicalFile = { id: string; customerId: string; category: "domestic_medical" | "japan_clinical" };
export type FileGrant = { fileId: string; granteeUserId: string; grantedByUserId: string; expiresAt: number; revokedAt: number | null };
export type Progress = { customerId: string; shareWithAgent: boolean };

export function canViewCustomer(actor: Actor, customer: Customer): boolean {
  if (!actor.active) return false;
  if (actor.role === "platform_admin") return true;
  if (actor.role === "agent") return actor.userId === customer.ownerUserId;
  return actor.organizationId === customer.organizationId;
}

export function canEditCustomer(actor: Actor, customer: Customer): boolean {
  if (!actor.active) return false;
  return actor.role === "platform_admin" || actor.userId === customer.ownerUserId;
}

export function canCreateCustomer(actor: Actor): boolean {
  return actor.active && (actor.role === "agent" || actor.role === "agency_manager" || actor.role === "platform_admin");
}

export function canViewFile(actor: Actor, customer: Customer, file: MedicalFile, grants: readonly FileGrant[], now: number): boolean {
  if (file.customerId !== customer.id || !canViewCustomer(actor,customer)) return false;
  if (actor.role === "platform_admin") return true;
  if (file.category === "domestic_medical") return true;
  return grants.some(g => g.fileId === file.id && g.granteeUserId === actor.userId &&
    g.expiresAt > now && g.revokedAt === null && g.grantedByUserId.length > 0);
}

export function canViewProgress(actor: Actor, customer: Customer, progress: Progress): boolean {
  if (progress.customerId !== customer.id || !canViewCustomer(actor,customer)) return false;
  return actor.role === "platform_admin" || progress.shareWithAgent;
}

export function canGrantJapanFile(actor: Actor, customer: Customer, file: MedicalFile): boolean {
  return actor.active && actor.role === "platform_admin" && file.category === "japan_clinical" && file.customerId === customer.id;
}
