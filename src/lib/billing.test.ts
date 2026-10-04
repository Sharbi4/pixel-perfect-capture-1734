import { expect, it } from "vitest";
import { requirePaidAccess } from "./billing.server";
it("fails closed for missing, invalid and expired payment grants",()=>{
  for(const s of [null,{}, {paid_access_until:"invalid"},{paid_access_until:new Date(Date.now()-1000).toISOString()}])expect(()=>requirePaidAccess(s)).toThrow(/checkout/);
});
it("allows an unexpired server-owned payment grant",()=>{expect(()=>requirePaidAccess({paid_access_until:new Date(Date.now()+60000).toISOString()})).not.toThrow();});
