import { useEffect, useState } from "react";

type Profile={user_id:string;role:"admin"|"agent";display_name:string;active:boolean};
type Client={id:string;owner_id:string;client_code:string;project:string;stage:string;contract_amount:number;received_amount:number;cost_amount:number;commission_amount:number};
const url=(import.meta.env.VITE_SUPABASE_URL??"").replace(/\/$/,"");
const key=import.meta.env.VITE_SUPABASE_ANON_KEY??"";
const configured=Boolean(url&&key&&url.startsWith("https://"));
const stages=["咨询中","已预约","赴日中","服务完成","待回访"];
const cash=(n:number)=>"¥"+n.toLocaleString("zh-CN",{maximumFractionDigits:2});
export default function Pilot(){
 const [token,setToken]=useState("");
 const [userId,setUserId]=useState("");
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [profile,setProfile]=useState<Profile|null>(null);
 const [rows,setRows]=useState<Client[]>([]);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [clientCode,setClientCode]=useState("");
 const [project,setProject]=useState("日本精密体检");
 const [amount,setAmount]=useState("0");
 const [received,setReceived]=useState("0");
 const [cost,setCost]=useState("0");
 const [commission,setCommission]=useState("0");
 async function request<T>(path:string,access:string,options:RequestInit={}):Promise<T>{
   const res=await fetch(url+path,{...options,headers:{"apikey":key,"Authorization":"Bearer "+access,"Content-Type":"application/json",...options.headers}});
   if(!res.ok){let msg="请求失败："+res.status;try{const body=await res.json() as {message?:string;error_description?:string};msg=body.message||body.error_description||msg;}catch{}throw new Error(msg);}
   if(res.status===204)return null as T;
   return res.json() as Promise<T>;
 }
 async function load(access:string,id:string){
   const [profiles,clients]=await Promise.all([
     request<Profile[]>("/rest/v1/pilot_profiles?select=user_id,role,display_name,active&user_id=eq."+encodeURIComponent(id),access),
     request<Client[]>("/rest/v1/pilot_clients?select=*&order=created_at.desc",access)
   ]);
   const p=profiles[0];
   if(!p?.active)throw new Error("账号尚未启用，请联系管理员。");
   setProfile(p);setRows(clients);
 }
 async function signIn(){
   if(!configured)return;
   setBusy(true);setError("");
   try{
     const auth=await request<{access_token:string;user:{id:string}}>("/auth/v1/token?grant_type=password",key,{method:"POST",body:JSON.stringify({email,password})});
     await load(auth.access_token,auth.user.id);
     setToken(auth.access_token);setUserId(auth.user.id);setPassword("");
   }catch(e){setError(e instanceof Error?e.message:"登录失败");}finally{setBusy(false);}
 }
 async function refresh(){setBusy(true);try{await load(token,userId);setError("");}catch(e){setError(String(e));}finally{setBusy(false);}}
 async function add(){
   const nums=[amount,received,cost,commission].map(Number);
   if(!clientCode.trim()||clientCode.length>60||nums.some(n=>!Number.isFinite(n)||n<0)||nums[1]>nums[0]){setError("请填写客户代号和有效金额。");return;}
   setBusy(true);
   try{
     await request("/rest/v1/pilot_clients",token,{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify({owner_id:userId,client_code:clientCode.trim(),project,stage:"咨询中",contract_amount:nums[0],received_amount:nums[1],cost_amount:nums[2],commission_amount:nums[3]})});
     setClientCode("");await load(token,userId);setError("");
   }catch(e){setError(String(e));}finally{setBusy(false);}
 }
 async function changeStage(item:Client,next:string){
   setBusy(true);
   try{await request("/rest/v1/pilot_clients?id=eq."+encodeURIComponent(item.id),token,{method:"PATCH",headers:{"Prefer":"return=minimal"},body:JSON.stringify({stage:next})});await load(token,userId);setError("");}
   catch(e){setError(String(e));}finally{setBusy(false);}
 }
 function logout(){setToken("");setUserId("");setProfile(null);setRows([]);setPassword("");}
 useEffect(()=>{document.title="Link Health · 试运营";},[]);
 const total=rows.reduce((s,r)=>s+r.received_amount,0);
 const profit=rows.reduce((s,r)=>s+r.received_amount-r.cost_amount-r.commission_amount,0);
 return <main style={{maxWidth:1080,margin:"32px auto",padding:20}}>
   <h1>Link Health <small style={{fontSize:15}}>V3 四账号试运营</small></h1>
   <p>仅供虚构客户代号与模拟金额测试。禁止录入真实姓名、电话、病历或诊疗报告。</p>
   {!configured?<section className="panel" style={{padding:24}}><h2>尚未连接数据库</h2><p>需要配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY，并在私有 Supabase 测试项目中执行数据库初始化脚本。</p><p>此页面尚不能登录或保存云端数据。</p></section>:
   !token?<section className="panel" style={{padding:24,maxWidth:480}}><h2>试用账号登录</h2><label>邮箱<input autoComplete="username" type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>密码<input autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><p><button className="button primary" disabled={busy||!email||!password} onClick={signIn}>登录</button></p></section>:
   <><section className="panel" style={{padding:20,marginBottom:16}}><h2>{profile?.display_name} · {profile?.role==="admin"?"管理员":"代理"}</h2><p>数据库按账号隔离记录。管理员查看全部客户，代理仅查看自己的客户。</p><button className="button" onClick={refresh} disabled={busy}>刷新</button> <button className="button" onClick={logout}>退出登录</button><div className="agent-metrics"><div><small>可见客户</small><strong>{rows.length}</strong></div><div><small>已收款</small><strong>{cash(total)}</strong></div><div><small>模拟毛利</small><strong>{cash(profit)}</strong></div></div></section>
   <section className="panel" style={{padding:20,marginBottom:16}}><h3>新增客户备案（仅虚构资料）</h3><div className="agent-controls"><label>客户代号<input maxLength={60} value={clientCode} onChange={e=>setClientCode(e.target.value)} placeholder="例如：测试客户 A"/></label><label>项目<input maxLength={80} value={project} onChange={e=>setProject(e.target.value)}/></label><label>合同金额<input type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>已收金额<input type="number" min="0" value={received} onChange={e=>setReceived(e.target.value)}/></label><label>成本<input type="number" min="0" value={cost} onChange={e=>setCost(e.target.value)}/></label><label>佣金<input type="number" min="0" value={commission} onChange={e=>setCommission(e.target.value)}/></label><button className="button primary" disabled={busy} onClick={add}>备案客户</button></div></section>
   <section className="panel" style={{padding:20}}><h3>客户跟踪与财务台账</h3><div className="table-scroll"><table><thead><tr><th>客户代号</th><th>项目</th><th>进度</th><th>合同额</th><th>已收款</th><th>成本</th><th>佣金</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.client_code}</td><td>{r.project}</td><td>{r.owner_id===userId?<select disabled={busy} value={r.stage} onChange={e=>changeStage(r,e.target.value)}>{stages.map(s=><option key={s}>{s}</option>)}</select>:r.stage}</td><td>{cash(r.contract_amount)}</td><td>{cash(r.received_amount)}</td><td>{cash(r.cost_amount)}</td><td>{cash(r.commission_amount)}</td></tr>)}</tbody></table></div></section></>}
   {error&&<p role="alert" style={{color:"crimson"}}>{error}</p>}
 </main>;
}
