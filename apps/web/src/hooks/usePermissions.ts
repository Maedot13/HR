import { useMemo } from "react";
import { computeEffectivePermissions } from "@hrms/shared";
import { useAuth } from "../contexts/AuthContext.js";
import type { BaseRole, SpecialPrivilege } from "@hrms/shared";

/**
 * Returns the current user's effective permission Set (role ∪ privilege).
 * Uses the same computeEffectivePermissions() as the backend — guaranteeing parity.
 * Re-computes only when role or specialPrivilege changes.
 */
export function usePermissions(): Set<string> {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user) return new Set<string>();
    return computeEffectivePermissions(
      user.role as BaseRole,
      user.specialPrivilege as SpecialPrivilege | undefined
    );
  }, [user?.role, user?.specialPrivilege]);
}
