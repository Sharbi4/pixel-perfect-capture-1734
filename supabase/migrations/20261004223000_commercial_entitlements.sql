-- Plan selection is a preview preference; paid entitlements are backend-owned.
REVOKE UPDATE (plan_tier, scheduling_addon) ON public.salons FROM authenticated;
