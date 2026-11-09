import {useEffect,useState} from "react";
import type {FormEvent} from "react";

type Role="admin"|"agent"|"patient";
type Profile={user_id:string;role:Role;display_name:string;active:boolean};
type CaseRow={id:string;client_code:string;project:string;stage:string;agent_id:string|null;patient_id:string|null;created_at:string;updated_at:string};
type Commission={id:string;case_id:string;agent_id:string;amount:number;status:string};
type Report={id:string;case_id:string;title:string;report_type:string;file_path:string|null;report_date:string|null};
type CarePlan={id:string;case_id:string;category:string;title:string;content:string;patient_visible:boolean;reviewed_by:string|null};
type AuthReply={access_token:string;refresh_token:string;user:{id:string}};
const endpoint=(import.meta.env.VITE_SUPABASE_URL??"").replace(/\/$/,"");
const apikey=import.meta.env.VITE_SUPABASE_ANON_KEY??"";
const enabled=Boolean(endpoint.startsWith("https://")&&apikey);
const stages=["咨询中","资料整理","医学评估","预约确认","医疗服务中","后续随访","服务完成"];
const categories=["医生建议","饮食饮水","运动睡眠","药物及补充剂","复诊随访"];
const money=(n:number)=>"¥"+Number(n||0).toLocaleString("zh-CN",{maximumFractionDigits:2});
let seedRefreshPromise:Promise<AuthReply>|null=null;
const box:React.CSSProperties={background:"#fff",border:"1px solid #e0e9e8",padding:20,borderRadius:15,marginBottom:17};
const inp:React.CSSProperties={width:"100%",padding:"11px 12px",border:"1px solid #c8d9d8",borderRadius:9,background:"#fff",color:"#183652",fontSize:15,boxSizing:"border-box"};
const btn:React.CSSProperties={padding:"11px 17px",border:0,borderRadius:9,background:"#123b5b",color:"#fff",fontWeight:600,cursor:"pointer"};
const group:React.CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:13,alignItems:"end"};
const label:React.CSSProperties={display:"grid",gap:6,fontSize:13,fontWeight:600};
async function api<T>(path:string,bearer:string,options:RequestInit={}):Promise<T>{
 const res=await fetch(endpoint+path,{...options,headers:{apikey,Authorization:"Bearer "+bearer,"Content-Type":"application/json",...options.headers}});
 if(!res.ok){
   let details:{error_code?:string;code?:number;msg?:string;message?:string}={};
   try{details=await res.json() as typeof details;}catch{ /* do not expose raw backend responses */ }
   const code=details.error_code||"";
   const description=details.msg||details.message||"";
   if(res.status===429||code==="over_email_send_rate_limit"){
     const wait=description.match(/after\\s+(\\d+)\\s+seconds?/i)?.[1];
     throw new Error("验证码邮件发送太频繁。"+(wait?"请在"+wait+"秒后再试。":"请稍后再试。")+"如果已经注册，请勿重复注册；先到邮箱查找验证邮件。");
   }
   if(code==="email_not_confirmed")throw new Error("邮箱尚未验证。请在邮箱收件箱或垃圾邮件中找到确认邮件，点击链接后返回登录。");
   if(code==="invalid_credentials"||code==="invalid_grant")throw new Error("账号或密码不正确。请确认输入信息，或联系工作人员协助。");
   if(code==="user_already_exists"||code==="email_exists")throw new Error("该邮箱可能已经注册。请切换到登录，不要重复创建账号。");
   if(res.status===400&&path.includes("/auth/v1/signup"))throw new Error("注册未完成。请检查邮箱与密码；如已收到验证邮件，请先完成验证后登录。");
   throw new Error("操作暂时未成功（"+res.status+"）。请稍后重试或联系工作人员。");
  }
 if(res.status===204)return null as T;
 const body=await res.text();return body?JSON.parse(body) as T:null as T;
}
function shortDate(d:string){return d?d.slice(0,10):"—";}
export default function Pilot(){
 const [token,setToken]=useState("");const [uid,setUid]=useState("");
 const [email,setEmail]=useState("");const [password,setPassword]=useState("");
 const [signup,setSignup]=useState(false);
 const [agentCreateEmail,setAgentCreateEmail]=useState("");
 const [agentCreateName,setAgentCreateName]=useState("");
 const [agentCredentials,setAgentCredentials]=useState<{email:string;name:string;password:string}|null>(null);
 const [currentNewPassword,setCurrentNewPassword]=useState("");
 const [profile,setProfile]=useState<Profile|null>(null);
 const [profiles,setProfiles]=useState<Profile[]>([]);
 const [cases,setCases]=useState<CaseRow[]>([]);const [commissions,setCommissions]=useState<Commission[]>([]);
 const [reports,setReports]=useState<Report[]>([]);const [plans,setPlans]=useState<CarePlan[]>([]);
 const [tab,setTab]=useState<"cases"|"medical"|"members">("cases");
 const [activeCase,setActiveCase]=useState("");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const [newCode,setNewCode]=useState("");const [newProject,setNewProject]=useState("日本肠道微生态医疗");const [newAgent,setNewAgent]=useState("");
 const [approveEmail,setApproveEmail]=useState("");const [approveName,setApproveName]=useState("");
 const [approveRole,setApproveRole]=useState<"agent"|"patient">("agent");
 const [reportTitle,setReportTitle]=useState("");const [reportFile,setReportFile]=useState<File|null>(null);
 const [planCat,setPlanCat]=useState("医生建议");const [planTitle,setPlanTitle]=useState("");const [planText,setPlanText]=useState("");
 const [planReviewer,setPlanReviewer]=useState("");const [planVisible,setPlanVisible]=useState(false);
 const [commissionAmount,setCommissionAmount]=useState("0");
 const role=profile?.role;
 async function load(access:string,id:string){
  const self=await api<Profile[]>("/rest/v1/pilot_profiles?select=user_id,role,display_name,active&user_id=eq."+encodeURIComponent(id),access);
  if(!self[0])throw new Error("账户资料暂不可用，请联系管理员。");
  if(!self[0].active)throw new Error("合作伙伴账户正在审核，请等待管理员启用后再登录。");
  const [c,cm,r,p]=await Promise.all([
   api<CaseRow[]>("/rest/v1/lh_cases?select=*&order=created_at.desc",access),
   api<Commission[]>("/rest/v1/lh_commissions?select=*&order=updated_at.desc",access),
   api<Report[]>("/rest/v1/lh_reports?select=*&order=created_at.desc",access),
   api<CarePlan[]>("/rest/v1/lh_care_plans?select=*&order=updated_at.desc",access),
  ]);
  const staff=self[0].role==="admin"?await api<Profile[]>("/rest/v1/pilot_profiles?select=user_id,role,display_name,active&order=role.asc",access):[];
  setProfile(self[0]);setUid(id);setToken(access);setCases(c);setCommissions(cm);setReports(r);setPlans(p);setProfiles(staff);
  setActiveCase(v=>c.some(x=>x.id===v)?v:c[0]?.id??"");
 }
 async function login(e:FormEvent){e.preventDefault();setBusy(true);setError("");setNotice("");
  try{const auth=await api<AuthReply>("/auth/v1/token?grant_type=password",apikey,{method:"POST",body:JSON.stringify({email,password})});await load(auth.access_token,auth.user.id);sessionStorage.setItem("lh_seed_refresh",auth.refresh_token);setPassword("");}
  catch(err){setError(String(err instanceof Error?err.message:err));}finally{setBusy(false);}
 }
 async function register(e:FormEvent){e.preventDefault();setBusy(true);setError("");setNotice("");
  try{
   const a=await api<AuthReply & {user?:{id:string}} >("/auth/v1/signup",apikey,{method:"POST",body:JSON.stringify({email,password,data:{account_type:"patient"}})});
   setSignup(false);
   if(a.access_token&&a.user?.id){
     await load(a.access_token,a.user.id);
     if(a.refresh_token)sessionStorage.setItem("lh_seed_refresh",a.refresh_token);
     setNotice("注册成功，已进入个人健康中心。");
   }else{
     setNotice("注册资料已提交。当前后台仍要求邮箱验证，请先完成邮件确认后登录；管理员无需审核。");
   }
   setPassword("");
  }
  catch(err){setError(String(err));}finally{setBusy(false);}
 }
 useEffect(()=>{
  document.title="LINK HEALTH · 健康服务中心";
  const ref=sessionStorage.getItem("lh_seed_refresh");
  if(!enabled||!ref)return;
  let cancelled=false;
  if(!seedRefreshPromise)seedRefreshPromise=api<AuthReply>("/auth/v1/token?grant_type=refresh_token",apikey,{method:"POST",body:JSON.stringify({refresh_token:ref})});
  void seedRefreshPromise.then(async a=>{if(!cancelled){await load(a.access_token,a.user.id);sessionStorage.setItem("lh_seed_refresh",a.refresh_token);}}).catch(()=>{if(!cancelled)sessionStorage.removeItem("lh_seed_refresh");});
  return()=>{cancelled=true;};
 },[]);
 function logout(){setProfile(null);setToken("");setUid("");setCases([]);setReports([]);setPlans([]);setCommissions([]);setProfiles([]);sessionStorage.removeItem("lh_seed_refresh");}
 async function work(task:()=>Promise<void>,success="已保存"){setBusy(true);setError("");setNotice("");try{await task();await load(token,uid);setNotice(success);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 async function addCase(){if(!newCode.trim()||!newProject.trim())return;await work(async()=>{await api("/rest/v1/lh_cases",token,{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({client_code:newCode.trim(),project:newProject.trim(),stage:"咨询中",agent_id:role==="agent"?uid:newAgent||null,patient_id:null,created_by:uid})});setNewCode("");},"客户备案已录入");}
 async function editCase(row:CaseRow,field:"stage"|"agent_id"|"patient_id",value:string){await work(async()=>{await api("/rest/v1/lh_cases?id=eq."+row.id,token,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({[field]:value||null,updated_at:new Date().toISOString()})});},"已更新客户关联或进度");}
 async function setCommission(row:CaseRow,amount:string,status:string){if(!row.agent_id)return;await work(async()=>{
  await api("/rest/v1/lh_commissions?on_conflict=case_id",token,{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({case_id:row.id,agent_id:row.agent_id,amount:Number(amount),status,updated_at:new Date().toISOString()})});
 },"分润信息已更新");}
 async function approve(){if(!approveEmail.trim()||!approveName.trim())return;await work(async()=>{
  await api("/rest/v1/rpc/lh_approve_signup",token,{method:"POST",body:JSON.stringify({p_email:approveEmail.trim(),p_role:approveRole,p_display_name:approveName.trim()})});
  setApproveEmail("");setApproveName("");
 },"账号审核已完成。请提醒对方重新登录。");}
 async function createAgent(e:FormEvent){
  e.preventDefault();
  if(!agentCreateEmail.trim()||!agentCreateName.trim())return;
  setBusy(true);setError("");setNotice("");setAgentCredentials(null);
  try{
   const res=await fetch(endpoint+"/functions/v1/admin-create-agent",{
     method:"POST",headers:{"Authorization":"Bearer "+token,apikey,"Content-Type":"application/json"},
     body:JSON.stringify({email:agentCreateEmail.trim(),name:agentCreateName.trim()})
   });
   const data=await res.json() as {error?:string,email?:string,name?:string,password?:string};
   if(!res.ok||!data.password||!data.email||!data.name)throw new Error(data.error||"创建失败，请联系管理员");
   setAgentCredentials({email:data.email,name:data.name,password:data.password});
   setAgentCreateEmail("");setAgentCreateName("");
   await load(token,uid);
   setNotice("合作伙伴账号已开通，请安全发送初始密码，提醒对方立即修改。");
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 async function changePassword(e:FormEvent){
  e.preventDefault();if(currentNewPassword.length<12){setError("新密码建议至少12位");return}
  setBusy(true);setError("");setNotice("");
  try{
   await api("/auth/v1/user",token,{method:"PUT",body:JSON.stringify({password:currentNewPassword})});
   setCurrentNewPassword("");setNotice("密码已修改，请妥善保管。");
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 async function upload(){if(!activeCase||!reportTitle.trim()||!reportFile)return;
  if(!["application/pdf","image/png","image/jpeg"].includes(reportFile.type)||reportFile.size>10*1024*1024){setError("测试附件仅支持 PDF/JPG/PNG，单份不超过10MB。");return;}
  await work(async()=>{
   const ext=reportFile.type==="application/pdf"?"pdf":reportFile.type==="image/png"?"png":"jpg";
   const path=activeCase+"/"+crypto.randomUUID()+"."+ext;
   const res=await fetch(endpoint+"/storage/v1/object/lh-pilot-reports/"+path,{method:"POST",headers:{apikey,Authorization:"Bearer "+token,"Content-Type":reportFile.type,"x-upsert":"false"},body:reportFile});
   if(!res.ok)throw new Error("私有报告上传失败："+res.status);
   await api("/rest/v1/lh_reports",token,{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({case_id:activeCase,title:reportTitle.trim(),report_type:"医疗报告",file_path:path,created_by:uid})});
   setReportTitle("");setReportFile(null);
  },"测试报告已进入私有档案");}
 async function viewReport(r:Report){if(!r.file_path)return;setBusy(true);setError("");
  try{const res=await fetch(endpoint+"/storage/v1/object/authenticated/lh-pilot-reports/"+r.file_path,{headers:{apikey,Authorization:"Bearer "+token}});if(!res.ok)throw new Error("没有权限打开报告（"+res.status+"）");
   const blob=await res.blob();const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=r.title+(blob.type==="application/pdf"?".pdf":blob.type==="image/png"?".png":".jpg");a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);
  }catch(e){setError(String(e));}finally{setBusy(false);}
 }
 async function addPlan(){if(!activeCase||!planTitle.trim()||!planText.trim())return;
  if(planVisible&&!planReviewer.trim()){setError("发布给客户前，必须填写已确认建议的医生或专业人员。");return;}
  await work(async()=>{await api("/rest/v1/lh_care_plans",token,{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({case_id:activeCase,category:planCat,title:planTitle.trim(),content:planText.trim(),patient_visible:planVisible,reviewed_by:planReviewer.trim()||null,created_by:uid})});setPlanTitle("");setPlanText("");setPlanReviewer("");setPlanVisible(false);},"管理建议已保存");}
 function exportLedger(){const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),cases,commissions},null,2)],{type:"application/json"});const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download="link-health-seed-ledger.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);}
 const active=cases.find(c=>c.id===activeCase);
 const commissionFor=(c:CaseRow)=>commissions.find(x=>x.case_id===c.id);
 const nameOf=(id:string|null)=>profiles.find(p=>p.user_id===id)?.display_name??(id?"已分配":"未分配");
 return <main className="lh-seed" style={{maxWidth:1140,margin:"0 auto",padding:"28px 15px 60px",color:"#183653",lineHeight:1.65}}>
  <header style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",gap:14,alignItems:"center",marginBottom:26}}>
   <div><div style={{color:"#168778",letterSpacing:2,fontSize:12}}>LINK HEALTH</div><h1 style={{margin:"5px 0 0",fontSize:"clamp(24px,4vw,36px)"}}>{role==="admin"?"医疗运营管理":role==="agent"?"项目服务管理":role==="patient"?"我的健康中心":"健康服务中心"}</h1><p style={{margin:"5px 0",color:"#627986"}}>个性化精准医疗与主动健康管理</p></div>
   {profile&&<div><strong>{profile.display_name}</strong><br/><button type="button" style={{...btn,background:"#456779",marginTop:8}} onClick={logout}>退出登录</button></div>}
  </header>
  {error&&<div role="alert" style={{...box,borderColor:"#d16b69",color:"#a33131"}}>{error}</div>}
  {notice&&<div role="status" style={{...box,borderColor:"#9acbbc",color:"#166f65"}}>{notice}</div>}
  {!enabled?<section style={box}>尚未检测到 CRM 数据库配置。请检查站点部署环境变量。</section>:
   !profile?<section style={{...box,maxWidth:500,margin:"25px auto",padding:30}}>
    <h2 style={{marginTop:0}}>{signup?"注册账号":"账号登录"}</h2><p style={{color:"#607989"}}>{signup?"客户无需人工审核；目前系统仍要求邮箱确认，完成后即可登录。合作伙伴账号由管理员统一创建。":"请登录以查看您的专属服务信息。"}</p>
    <form onSubmit={signup?register:login} style={{display:"grid",gap:14}}>
     
     <label style={label}>电子邮箱<input style={inp} type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="example@email.com"/></label>
     <label style={label}>密码（至少8位）<input style={inp} type="password" minLength={8} required autoComplete={signup?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)}/></label>
     
     <button type="submit" style={btn} disabled={busy}>{busy?"正在处理…":signup?"注册个人账号":"登录"}</button>
    </form><button type="button" style={{border:0,background:"none",color:"#0b7f79",marginTop:16,cursor:"pointer"}} onClick={()=>{setSignup(!signup);setError("");}}>{signup?"已有账号？登录":"注册账号 →"}</button>
    <p style={{fontSize:12,color:"#70828a",marginTop:22}}>邮箱确认后可直接登录个人中心，无需人工审核；医疗档案须由工作人员核对身份并绑定后才能查看。</p>
   </section>:
   <>
   <div style={{...box,background:"#ecf6f4"}}><strong>账户权限：</strong>{role==="admin"?"管理全部客户进度、代理分润和医疗档案。":role==="agent"?"仅查看本人报备或分配的客户服务节点及本人分润，不可查看病历、内部成本。":"仅查看与本人账号绑定的服务进度、医疗报告及已确认的健康建议。"}
   <p style={{margin:"7px 0 0",fontSize:12,color:"#53727b"}}>种子期请使用客户代号与虚构报告测试；正式上传真实病历前需完成数据保护与授权检查。</p></div>
   {role==="agent"&&<details style={{...box,background:"#f6faf9"}}><summary style={{cursor:"pointer",fontWeight:600}}>修改初始密码（首次登录后请立即修改）</summary><form onSubmit={changePassword} style={{display:"flex",flexWrap:"wrap",alignItems:"end",gap:10,marginTop:15}}><label style={label}>新密码（至少12位）<input style={inp} type="password" minLength={12} required autoComplete="new-password" value={currentNewPassword} onChange={e=>setCurrentNewPassword(e.target.value)}/></label><button type="submit" style={btn} disabled={busy||currentNewPassword.length<12}>保存新密码</button></form></details>}
   <div style={{display:"flex",flexWrap:"wrap",gap:9,marginBottom:20}}>
    <button type="button" style={{...btn,background:tab==="cases"?"#123b5b":"#6d8490"}} onClick={()=>setTab("cases")}>{role==="patient"?"我的服务进度":"客户与进度"} ({cases.length})</button>
    {role!=="agent"&&<button type="button" style={{...btn,background:tab==="medical"?"#123b5b":"#6d8490"}} onClick={()=>setTab("medical")}>医疗报告与健康计划</button>}
    {role==="admin"&&<button type="button" style={{...btn,background:tab==="members"?"#123b5b":"#6d8490"}} onClick={()=>setTab("members")}>合作伙伴账号管理</button>}
    <button type="button" style={{...btn,background:"#168679"}} onClick={()=>void work(async()=>{},"已刷新")}>刷新</button>
   </div>
   {tab==="cases"&&<>
    {(role==="admin"||role==="agent")&&<section style={box}><h2 style={{marginTop:0}}>新增客户备案</h2><p style={{fontSize:13,color:"#657b85"}}>先使用客户代号，勿在这里填写姓名、电话、病情或具体诊断。</p><div style={group}>
     <label style={label}>客户代号<input style={inp} maxLength={60} placeholder="例如：KH-001" value={newCode} onChange={e=>setNewCode(e.target.value)}/></label>
     <label style={label}>服务项目<input style={inp} maxLength={120} value={newProject} onChange={e=>setNewProject(e.target.value)}/></label>
     {role==="admin"&&<label style={label}>指定代理<select style={inp} value={newAgent} onChange={e=>setNewAgent(e.target.value)}><option value="">管理员直接客户</option>{profiles.filter(p=>p.active&&p.role==="agent").map(p=><option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}</select></label>}
     <button type="button" style={btn} disabled={busy||!newCode.trim()} onClick={()=>void addCase()}>保存备案</button>
    </div></section>}
    <section style={box}><h2 style={{marginTop:0}}>{role==="patient"?"我的服务进度":"客户服务台账"}</h2>
     {!cases.length?<p>暂无已绑定的服务项目。您已可以登录健康中心；医疗档案与报告需要由工作人员核实身份并单独绑定后显示。</p>:
     <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:role==="patient"?500:780,fontSize:14}}><thead><tr style={{textAlign:"left",background:"#edf5f4"}}><th>客户代号</th><th>服务项目</th><th>进度节点</th>{role!=="patient"&&<th>代理</th>}{role!=="patient"&&<th>本人分润</th>}{role==="admin"&&<th>客户账号绑定</th>}</tr></thead><tbody>
      {cases.map(c=>{const cm=commissionFor(c);return <tr key={c.id} style={{borderBottom:"1px solid #e2e9e8"}}>
       <td style={{padding:"12px 7px",fontWeight:700}}>{c.client_code}</td><td style={{padding:"12px 7px"}}>{c.project}</td>
       <td style={{padding:"12px 7px"}}>{role==="admin"?<select style={{...inp,minWidth:128}} disabled={busy} value={c.stage} onChange={e=>void editCase(c,"stage",e.target.value)}>{stages.map(x=><option key={x}>{x}</option>)}</select>:c.stage}</td>
       {role!=="patient"&&<td style={{padding:"12px 7px"}}>{role==="admin"?<select style={{...inp,minWidth:125}} disabled={busy} value={c.agent_id??""} onChange={e=>void editCase(c,"agent_id",e.target.value)}><option value="">管理员直客</option>{profiles.filter(p=>p.active&&p.role==="agent").map(p=><option value={p.user_id} key={p.user_id}>{p.display_name}</option>)}</select>:nameOf(c.agent_id)}</td>}
       {role!=="patient"&&<td style={{padding:"12px 7px"}}>{cm?money(cm.amount)+" · "+cm.status:"待设置"}{role==="admin"&&c.agent_id&&<button type="button" onClick={()=>{setActiveCase(c.id);setCommissionAmount(String(cm?.amount??0));}} style={{display:"block",border:0,background:"none",color:"#147c77",cursor:"pointer"}}>设置分润 ↓</button>}</td>}
       {role==="admin"&&<td style={{padding:"12px 7px"}}><select style={{...inp,minWidth:125}} disabled={busy} value={c.patient_id??""} onChange={e=>void editCase(c,"patient_id",e.target.value)}><option value="">尚未绑定</option>{profiles.filter(p=>p.active&&p.role==="patient").map(p=><option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}</select></td>}
      </tr>})}
     </tbody></table></div>}
    </section>
    {role==="admin"&&active?.agent_id&&<section style={box}><h3>代理分润设置 · {active.client_code}</h3><div style={group}>
      <label style={label}>分润金额（仅本人代理与管理员可见）<input style={inp} type="number" min="0" step="0.01" value={commissionAmount} onChange={e=>setCommissionAmount(e.target.value)}/></label>
      {["待审核","待结算","已结算"].map(status=><button key={status} disabled={busy||!Number.isFinite(Number(commissionAmount))||Number(commissionAmount)<0} type="button" style={{...btn,background:status==="已结算"?"#127c70":"#587486"}} onClick={()=>void setCommission(active,commissionAmount,status)}>保存为{status}</button>)}
     </div></section>}
    {role==="admin"&&<section style={box}><h3>种子期台账备份</h3><p>免费版不包含自动日备份。可导出客户代号、进度与分润台账，建议在加密设备中保存。</p><button type="button" onClick={exportLedger} style={btn}>导出非医疗台账 JSON</button></section>}
   </>}
   {tab==="medical"&&role!=="agent"&&<section style={box}><h2 style={{marginTop:0}}>医疗档案与健康计划</h2>
    <p style={{color:"#5c7881"}}>{role==="admin"?"这里仅供测试上传；真实医疗报告上线前需完成跨境数据合规和隐私审核。":"你只能看到与自己绑定的报告和已确认发布的健康建议。"}</p>
    <label style={{...label,maxWidth:430,marginBottom:20}}>选择服务档案<select style={inp} value={activeCase} onChange={e=>setActiveCase(e.target.value)}>{cases.map(c=><option key={c.id} value={c.id}>{c.client_code} · {c.project}</option>)}</select></label>
    {!active?<p>暂无服务档案。</p>:<>
     <h3>医疗报告</h3>
     {reports.filter(r=>r.case_id===activeCase).map(r=><div key={r.id} style={{padding:"12px 0",borderBottom:"1px solid #e0e9e7",display:"flex",justifyContent:"space-between",gap:10}}><span>{r.title} <small style={{color:"#72858a"}}>{shortDate(r.report_date??"")}</small></span><button type="button" disabled={busy||!r.file_path} style={{...btn,padding:"6px 12px"}} onClick={()=>void viewReport(r)}>安全下载</button></div>)}
     {!reports.some(r=>r.case_id===activeCase)&&<p style={{color:"#7a8d91"}}>暂无报告</p>}
     {role==="admin"&&<div style={{...box,background:"#f6fbfa",marginTop:20}}><h3>上传测试报告</h3><div style={group}><label style={label}>报告名称<input style={inp} maxLength={180} value={reportTitle} onChange={e=>setReportTitle(e.target.value)}/></label><label style={label}>文件（PDF / JPG / PNG，小于10MB）<input style={inp} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>setReportFile(e.target.files?.[0]??null)}/></label><button type="button" style={btn} disabled={busy||!reportTitle.trim()||!reportFile} onClick={()=>void upload()}>上传至私有档案</button></div></div>}
     <h3>医生建议与管理计划</h3>
     {plans.filter(p=>p.case_id===activeCase).map(p=><div key={p.id} style={{...box,padding:15}}><div style={{color:"#158579",fontSize:12}}>{p.category} · {p.patient_visible?"已向客户发布":"内部草稿"}</div><strong>{p.title}</strong><p style={{whiteSpace:"pre-wrap",margin:"8px 0"}}>{p.content}</p>{p.reviewed_by&&<small>审核/确认人员：{p.reviewed_by}</small>}</div>)}
     {role==="admin"&&<div style={{...box,background:"#f6fbfa",marginTop:20}}><h3>录入管理建议（测试）</h3><div style={group}>
      <label style={label}>类别<select style={inp} value={planCat} onChange={e=>setPlanCat(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
      <label style={label}>标题<input style={inp} maxLength={120} value={planTitle} onChange={e=>setPlanTitle(e.target.value)}/></label>
      <label style={label}>医生或专业人员审核名称<input style={inp} value={planReviewer} onChange={e=>setPlanReviewer(e.target.value)} placeholder="发布前必须填写"/></label>
     </div><label style={{...label,marginTop:12}}>建议内容<textarea style={{...inp,minHeight:110}} maxLength={3000} value={planText} onChange={e=>setPlanText(e.target.value)} placeholder="仅录入专业人员已确认的内容；不要自行开药"/></label>
     <label style={{display:"flex",alignItems:"center",gap:9,margin:"12px 0"}}><input type="checkbox" checked={planVisible} onChange={e=>setPlanVisible(e.target.checked)}/>医生核对完成，向绑定客户发布</label><button type="button" style={btn} disabled={busy||!planTitle.trim()||!planText.trim()} onClick={()=>void addPlan()}>保存健康计划</button></div>}
    </>}
   </section>}
   {tab==="members"&&role==="admin"&&<section style={box}>
    <h2 style={{marginTop:0}}>创建合作伙伴账号</h2>
    <p style={{color:"#5b7580"}}>管理员填写姓名与邮箱，系统生成高强度初始密码并直接开通合作伙伴权限。首次登录请立即修改密码。</p>
    <form onSubmit={createAgent} style={{...group,marginBottom:12}}>
     <label style={label}>合作伙伴邮箱<input type="email" required style={inp} value={agentCreateEmail} onChange={e=>setAgentCreateEmail(e.target.value)} placeholder="partner@example.com"/></label>
     <label style={label}>姓名／显示名称<input required maxLength={80} style={inp} value={agentCreateName} onChange={e=>setAgentCreateName(e.target.value)} placeholder="例如：合作顾问"/></label>
     <button type="submit" disabled={busy||!agentCreateName.trim()||!agentCreateEmail.trim()} style={btn}>{busy?"正在创建…":"生成账号与初始密码"}</button>
    </form>
    {agentCredentials&&<div style={{...box,background:"#eef9f5",borderColor:"#7fc7b6",overflowWrap:"anywhere"}}>
      <strong>账号创建成功｜请立即复制并安全发送</strong>
      <p>姓名：{agentCredentials.name}</p><p>邮箱：{agentCredentials.email}</p>
      <p>初始密码：<code style={{fontSize:15,fontWeight:700}}>{agentCredentials.password}</code></p>
      <button type="button" style={{...btn,background:"#177d73"}} onClick={()=>void navigator.clipboard?.writeText("LINK HEALTH 合作伙伴登录\n网址：https://crm.91linker.com/\n邮箱："+agentCredentials.email+"\n初始密码："+agentCredentials.password+"\n首次登录请立即修改密码。")}>复制账号信息</button>
      <button type="button" style={{...btn,background:"#6b828a",marginLeft:8}} onClick={()=>setAgentCredentials(null)}>清除页面上的密码</button>
      <p style={{fontSize:12,color:"#5b7580",marginTop:10}}>密码不写入CRM业务表，只显示当前页面；请通过私密渠道单独发送，避免群聊公开。</p>
    </div>}
    <details style={{marginTop:18}}><summary style={{cursor:"pointer",color:"#527780"}}>处理此前已注册的待审核合作伙伴（旧流程）</summary>
    <p>仅适用于以前自行注册且已验证邮箱的合作伙伴。新合作伙伴请使用上方创建账号。</p>
    <div style={group}>
     <label style={label}>已验证邮箱<input style={inp} type="email" value={approveEmail} onChange={e=>setApproveEmail(e.target.value)}/></label>
     <label style={label}>显示名称<input style={inp} maxLength={80} value={approveName} onChange={e=>setApproveName(e.target.value)}/></label>
     <label style={label}>审核身份<select style={inp} value={approveRole} onChange={e=>setApproveRole(e.target.value as "agent"|"patient")}><option value="agent">合作伙伴</option><option value="patient">客户（仅用于历史账户修正）</option></select></label>
     <button type="button" style={btn} disabled={busy||!approveEmail.trim()||!approveName.trim()} onClick={()=>void approve()}>审核旧账号</button>
    </div></details><h3 style={{marginTop:26}}>已登记账户</h3>{profiles.map(p=><p key={p.user_id} style={{margin:"6px 0",fontSize:14}}>{p.display_name} · {p.role==="admin"?"管理员":p.role==="agent"?"代理":"客户"} · {p.active?"已启用":"待审核"}</p>)}<p style={{fontSize:12,color:"#71848c"}}>管理员账号不通过此界面授予；客户档案必须单独绑定后才能查看。</p>
   </section>}
   </>}
  <footer style={{marginTop:45,fontSize:12,color:"#809198",textAlign:"center"}}>LINK HEALTH · 个性化精准医疗与主动健康管理</footer>
 </main>;
}
