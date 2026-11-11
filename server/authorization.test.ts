import { describe, expect, it } from "vitest";
import { canCreateCustomer, canEditCustomer, canGrantJapanFile, canViewCustomer, canViewFile, canViewProgress, type Actor, type Customer, type FileGrant } from "./authorization";
const admin:Actor={userId:"admin",role:"platform_admin",active:true,organizationId:"platform"};
const a:Actor={userId:"a",role:"agent",active:true,organizationId:"org1"};
const b:Actor={userId:"b",role:"agent",active:true,organizationId:"org1"};
const manager:Actor={userId:"manager",role:"agency_manager",active:true,organizationId:"org1"};
const customer:Customer={id:"customer-a",ownerUserId:"a",organizationId:"org1"};
const japan={id:"report-jp",customerId:customer.id,category:"japan_clinical" as const};
const domestic={id:"report-cn",customerId:customer.id,category:"domestic_medical" as const};
const grant:FileGrant={fileId:japan.id,granteeUserId:"a",grantedByUserId:"admin",expiresAt:2000,revokedAt:null};
describe("V3 access boundaries",()=>{
 it("agents create and edit only their own customer",()=>{
   expect(canCreateCustomer(a)).toBe(true);
   expect(canViewCustomer(a,customer)).toBe(true);
   expect(canEditCustomer(a,customer)).toBe(true);
   expect(canViewCustomer(b,customer)).toBe(false);
   expect(canEditCustomer(b,customer)).toBe(false);
   expect(canViewCustomer(admin,customer)).toBe(true);
 });
 it("domestic reports are visible to owner, not another agent",()=>{
   expect(canViewFile(a,customer,domestic,[],1000)).toBe(true);
   expect(canViewFile(b,customer,domestic,[],1000)).toBe(false);
 });
 it("Japan reports are private by default even to owner or manager",()=>{
   expect(canViewFile(a,customer,japan,[],1000)).toBe(false);
   expect(canViewFile(manager,customer,japan,[],1000)).toBe(false);
   expect(canViewFile(admin,customer,japan,[],1000)).toBe(true);
 });
 it("single-file grants expire and revoke",()=>{
   expect(canViewFile(a,customer,japan,[grant],1000)).toBe(true);
   expect(canViewFile(a,customer,japan,[grant],2000)).toBe(false);
   expect(canViewFile(a,customer,japan,[{...grant,revokedAt:1500}],1000)).toBe(false);
   expect(canViewFile(b,customer,japan,[grant],1000)).toBe(false);
   expect(canViewFile(a,customer,{...japan,id:"other"},[grant],1000)).toBe(false);
 });
 it("inactive agent and unrelated file cannot be accessed",()=>{
   expect(canViewFile({...a,active:false},customer,japan,[grant],1000)).toBe(false);
   expect(canViewFile(a,customer,{...japan,customerId:"another"},[grant],1000)).toBe(false);
 });
 it("only admin can grant Japan reports",()=>{
   expect(canGrantJapanFile(admin,customer,japan)).toBe(true);
   expect(canGrantJapanFile(a,customer,japan)).toBe(false);
   expect(canGrantJapanFile(admin,customer,domestic)).toBe(false);
 });
 it("only shared progress visible to agent",()=>{
   expect(canViewProgress(a,customer,{customerId:customer.id,shareWithAgent:false})).toBe(false);
   expect(canViewProgress(a,customer,{customerId:customer.id,shareWithAgent:true})).toBe(true);
   expect(canViewProgress(admin,customer,{customerId:customer.id,shareWithAgent:false})).toBe(true);
 });
});
