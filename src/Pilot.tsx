import { useEffect, useRef, useState } from "react";

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
 const savingRef=useRef(false);
 const [register,setRegister]=useState(false);
 const [search,setSearch]=useState("");
 const [editing,setEditing]=useState<Client|null>(null);
 const [stageFilter,setStageFilter]=useState("全部");
 const [clientCode,setClientCode]=useState("");
 const [project,setProject]=useState("日本精密体检");
 const [amount,setAmount]=useState("0");
 const [received,setReceived]=useState("0");
 const [cost,setCost]=useState("0");
 const [commission,setCommission]=useState("0");
 async function request<T>(path:string,access:string,options:RequestInit={}):Promise<T>{
   const res=await fetch(url+path,{...options,headers:{"apikey":key,"Authorization":"Bearer "+access,"Content-Type":"application/json",...options.headers}});
   if(!res.ok){let msg="请求失败："+res.status;try{const body=await res.json() as {message?:string;error_description?:string};msg=body.message||body.error_description||msg;}catch{}throw new Error(msg);}
   // Minimal-return inserts can succeed with HTTP 201 and an empty body.
   if(res.status===204 || res.headers.get("content-length")==="0")return null as T;
   const body=await res.text();
   return body ? JSON.parse(body) as T : null as T;
 }
 async function load(access:string,id:string){
   const [profiles,clients]=await Promise.all([
     request<Profile[]>("/rest/v1/pilot_profiles?select=user_id,role,display_name,active&user_id=eq."+encodeURIComponent(id),access),
     request<Client[]>("/rest/v1/pilot_clients?select=*&order=created_at.desc",access)
   ]);
   const p=profiles[0];
   if(!p?.active)throw new Error("账号尚未通过管理员审核，请稍后再试。");
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
 async function signUp(){
   if(!configured)return;
   setBusy(true);setError("");
   try{
     await request("/auth/v1/signup",key,{method:"POST",body:JSON.stringify({email,password})});
     setPassword("");setRegister(false);
     setError("注册申请已提交。请按邮件提示验证邮箱，等待管理员审核后再登录。");
   }catch(e){setError(e instanceof Error?e.message:"注册失败");}finally{setBusy(false);}
 }
 async function refresh(){setBusy(true);try{await load(token,userId);setError("");}catch(e){setError(String(e));}finally{setBusy(false);}}
 async function add(){
   if(savingRef.current)return;
   const nums=[amount,received,cost,commission].map(Number);
   if(!clientCode.trim()||clientCode.length>60||nums.some(n=>!Number.isFinite(n)||n<0)||nums[1]>nums[0]){setError("请填写客户代号和有效金额。");return;}
   savingRef.current=true;setBusy(true);setError("");
   try{
     await request("/rest/v1/pilot_clients",token,{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify({owner_id:userId,client_code:clientCode.trim(),project,stage:"咨询中",contract_amount:nums[0],received_amount:nums[1],cost_amount:nums[2],commission_amount:nums[3]})});
     setClientCode("");await load(token,userId);setError("");
   }catch(e){setError("保存结果尚未确认，请先刷新列表核对，避免重复备案。"+String(e));}finally{savingRef.current=false;setBusy(false);}
 }
 async function changeStage(item:Client,next:string){
   setBusy(true);
   try{await request("/rest/v1/pilot_clients?id=eq."+encodeURIComponent(item.id),token,{method:"PATCH",headers:{"Prefer":"return=minimal"},body:JSON.stringify({stage:next})});await load(token,userId);setError("");}
   catch(e){setError(String(e));}finally{setBusy(false);}
 }
 async function saveEdit(){
   if(!editing||editing.owner_id!==userId)return;
   const vals=[editing.contract_amount,editing.received_amount,editing.cost_amount,editing.commission_amount];
   if(!editing.client_code.trim()||!editing.project.trim()||vals.some(n=>!Number.isFinite(n)||n<0)||editing.received_amount>editing.contract_amount){setError("请填写有效客户资料和金额。");return;}
   setBusy(true);setError("");
   try{
     await request("/rest/v1/pilot_clients?id=eq."+encodeURIComponent(editing.id),token,{method:"PATCH",headers:{"Prefer":"return=minimal"},body:JSON.stringify({client_code:editing.client_code.trim(),project:editing.project.trim(),contract_amount:editing.contract_amount,received_amount:editing.received_amount,cost_amount:editing.cost_amount,commission_amount:editing.commission_amount})});
     await load(token,userId);setEditing(null);
   }catch(e){setError("修改结果未确认，请刷新核对。"+String(e));}finally{setBusy(false);}
 }
 function logout(){setToken("");setUserId("");setProfile(null);setRows([]);setPassword("");}
 useEffect(()=>{document.title="Link Health · 试运营";},[]);
 const filteredRows=rows.filter(r=>(stageFilter==="全部"||r.stage===stageFilter)&&(!search.trim()||[r.client_code,r.project].some(v=>v.toLowerCase().includes(search.trim().toLowerCase()))));
 const total=rows.reduce((s,r)=>s+r.received_amount,0);
 const receivedMargin=rows.reduce((s,r)=>s+r.received_amount-r.cost_amount-r.commission_amount,0);
 const projectedMargin=rows.reduce((s,r)=>s+r.contract_amount-r.cost_amount-r.commission_amount,0);
 return <main style={{maxWidth:1080,margin:"32px auto",padding:20}}>
   <h1>Link Health <small style={{fontSize:15}}>V3 双账号试运营</small></h1>
   <p>仅供虚构客户代号与模拟金额测试。禁止录入真实姓名、电话、病历或诊疗报告。</p>
   {!configured?<section className="panel" style={{padding:24}}><h2>尚未连接数据库</h2><p>需要配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY，并在私有 Supabase 测试项目中执行数据库初始化脚本。</p><p>此页面尚不能登录或保存云端数据。</p></section>:
   !token?<section className="lh-login" style={{color:"#f3fbff",background:"radial-gradient(ellipse at 24% 35%,#16455b 0%,transparent 45%),radial-gradient(ellipse at 80% 75%,#173d49 0%,transparent 40%),#071520",borderRadius:28,overflow:"hidden",minHeight:570,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,320px),1fr))",boxShadow:"0 22px 70px #07152044",marginTop:20}}>
     <div style={{padding:"clamp(26px,5vw,58px)",position:"relative",minHeight:350,display:"flex",flexDirection:"column",justifyContent:"space-between",background:"radial-gradient(circle at 56% 42%,#26b8bd24,transparent 54%)"}}>
       <div style={{fontSize:13,letterSpacing:3,color:"#80e3dc",fontWeight:700}}>LINK HEALTH <span style={{color:"#e9faff"}}> / JAPAN</span></div>
       <div aria-hidden="true" style={{position:"relative",height:210,display:"grid",placeItems:"center"}}><div style={{width:180,height:180,border:"1px solid #7ee4dc66",borderRadius:"50%",boxShadow:"0 0 55px #36d8ca44,inset 0 0 55px #24c6bb22",display:"grid",placeItems:"center",background:"repeating-radial-gradient(circle at 48% 52%,transparent 0px,transparent 16px,#6ce1da33 17px,#6ce1da33 18px)"}}><div style={{width:105,height:105,borderRadius:"48% 52% 62% 38%",transform:"rotate(-23deg)",background:"radial-gradient(circle at 32% 29%,#d8fffa 0%,#5cdbd1 19%,#1d869f 53%,#0c304c 100%)",boxShadow:"0 0 34px #4ce6d688,inset -13px -12px 24px #061b35aa"}}/></div><span style={{position:"absolute",top:12,right:6,fontSize:10,letterSpacing:2,color:"#7ce0d9"}}>CELL / MICROBIOME</span><span style={{position:"absolute",bottom:10,left:0,fontSize:10,letterSpacing:2,color:"#7ce0d9"}}>PRECISION HEALTHCARE</span></div>
       <div><div style={{fontSize:11,letterSpacing:3,color:"#82e5dd",marginBottom:12}}>JAPAN MEDICAL INNOVATION</div><h2 style={{fontSize:"clamp(27px,4vw,40px)",lineHeight:1.25,color:"#fff",margin:"0 0 15px"}}>连接日本前沿医疗<br/>开启健康新可能</h2><p style={{color:"#b3cdd6",lineHeight:1.9,fontSize:13,margin:0}}>iPS 细胞研究 · 肠道微生态 · 精密健康管理<br/>专业连接，值得信赖。</p></div>
     </div>
     <div style={{padding:"clamp(26px,5vw,58px)",background:"#ffffff0b",display:"flex",flexDirection:"column",justifyContent:"center"}}><div style={{display:"inline-flex",alignSelf:"flex-start",border:"1px solid #71dacf55",color:"#a8eee5",borderRadius:40,padding:"7px 13px",fontSize:11,letterSpacing:2}}>SECURE ACCESS · 试运营</div><h2 style={{fontSize:29,color:"#fff",margin:"24px 0 8px"}}>{register?"渠道伙伴注册":"欢迎回来"}</h2><p style={{color:"#a7c2cd",fontSize:13,marginBottom:30}}>{register?"申请加入 Link Health 合作网络":"Link Health 跨境医疗业务管理平台"}</p>
       <form onSubmit={e=>{e.preventDefault();void (register?signUp():signIn());}}><label style={{display:"block",color:"#d9eef0",fontSize:13,marginBottom:18}}>电子邮箱<input required autoComplete="username" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" style={{display:"block",boxSizing:"border-box",width:"100%",marginTop:9,padding:14,borderRadius:11,border:"1px solid #8cd8d944",background:"#071a27",color:"#fff",fontSize:16}}/></label><label style={{display:"block",color:"#d9eef0",fontSize:13,marginBottom:23}}>登录密码<input required minLength={8} autoComplete={register?"new-password":"current-password"} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="至少 8 位密码" style={{display:"block",boxSizing:"border-box",width:"100%",marginTop:9,padding:14,borderRadius:11,border:"1px solid #8cd8d944",background:"#071a27",color:"#fff",fontSize:16}}/></label><button type="submit" disabled={busy||!email||password.length<8} style={{width:"100%",border:0,borderRadius:12,padding:16,fontWeight:700,fontSize:15,cursor:"pointer",background:"linear-gradient(105deg,#72e6d8,#4cbdce)",color:"#082432",opacity:busy?0.65:1}}>{busy?"请稍候…":register?"提交注册申请":"进入工作台 →"}</button></form>
       <button type="button" disabled={busy} onClick={()=>{setRegister(!register);setError("");}} style={{background:"none",border:0,color:"#8fe6dd",marginTop:22,cursor:"pointer",fontSize:13}}>{register?"已有账号？返回登录":"渠道伙伴？申请注册 →"}</button><p style={{color:"#829ea9",fontSize:11,lineHeight:1.7,textAlign:"center",marginTop:35}}>仅限授权用户 · 试运营期间禁止录入真实患者资料<br/>© Link Health</p>
     </div>
   </section>:
   <><section className="panel" style={{padding:20,marginBottom:16}}><h2>{profile?.display_name} · {profile?.role==="admin"?"管理员":"代理"}</h2><p>数据库按账号隔离记录。管理员查看全部客户，代理仅查看自己的客户。</p><button className="button" onClick={refresh} disabled={busy}>刷新</button> <button className="button" onClick={logout}>退出登录</button><div className="agent-metrics"><div><small>可见客户</small><strong>{rows.length}</strong></div><div><small>已收款</small><strong>{cash(total)}</strong></div><div><small>已收款减成本及佣金（模拟）</small><strong>{cash(receivedMargin)}</strong></div><div><small>合同额减成本及佣金（模拟）</small><strong>{cash(projectedMargin)}</strong></div></div></section>
   <section className="panel" style={{padding:20,marginBottom:16}}><h3>新增客户备案（仅虚构资料）</h3><div className="agent-controls"><label>客户代号<input maxLength={60} value={clientCode} onChange={e=>setClientCode(e.target.value)} placeholder="例如：测试客户 A"/></label><label>项目<input maxLength={80} value={project} onChange={e=>setProject(e.target.value)}/></label><label>合同金额<input type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>已收金额<input type="number" min="0" value={received} onChange={e=>setReceived(e.target.value)}/></label><label>成本<input type="number" min="0" value={cost} onChange={e=>setCost(e.target.value)}/></label><label>佣金<input type="number" min="0" value={commission} onChange={e=>setCommission(e.target.value)}/></label><button className="button primary" disabled={busy||!clientCode.trim()} onClick={add}>{busy?"保存中，请勿重复点击":"备案客户"}</button></div></section>
   {editing&&<section className="panel" style={{padding:20,marginBottom:16}}><h3>编辑测试客户</h3><div className="agent-controls"><label>客户代号<input maxLength={60} value={editing.client_code} onChange={e=>setEditing({...editing,client_code:e.target.value})}/></label><label>项目<input maxLength={80} value={editing.project} onChange={e=>setEditing({...editing,project:e.target.value})}/></label>{([["contract_amount","合同金额"],["received_amount","已收金额"],["cost_amount","成本"],["commission_amount","佣金"]] as const).map(([field,label])=><label key={field}>{label}<input type="number" min="0" value={editing[field]} onChange={e=>setEditing({...editing,[field]:Number(e.target.value)})}/></label>)}<button className="button primary" disabled={busy} onClick={saveEdit}>保存修改</button><button className="button" disabled={busy} onClick={()=>setEditing(null)}>取消</button></div></section>}
   <section className="panel" style={{padding:20}}><h3>客户跟踪与财务台账</h3><div className="agent-controls"><label>搜索客户或项目<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="输入客户代号或项目"/></label><label>按进度筛选<select value={stageFilter} onChange={e=>setStageFilter(e.target.value)}>{["全部",...stages].map(s=><option key={s}>{s}</option>)}</select></label></div><p>显示 {filteredRows.length} / {rows.length} 条记录</p><div className="table-scroll"><table><thead><tr><th>客户代号</th><th>项目</th><th>进度</th><th>合同额</th><th>已收款</th><th>成本</th><th>佣金</th><th>操作</th></tr></thead><tbody>{filteredRows.map(r=><tr key={r.id}><td>{r.client_code}</td><td>{r.project}</td><td>{r.owner_id===userId?<select disabled={busy} value={r.stage} onChange={e=>changeStage(r,e.target.value)}>{stages.map(s=><option key={s}>{s}</option>)}</select>:r.stage}</td><td>{cash(r.contract_amount)}</td><td>{cash(r.received_amount)}</td><td>{cash(r.cost_amount)}</td><td>{cash(r.commission_amount)}</td><td>{r.owner_id===userId?<button className="button" disabled={busy} onClick={()=>setEditing({...r})}>编辑</button>:"仅查看"}</td></tr>)}</tbody></table></div></section></>}
   {error&&<p role="alert" style={{color:"crimson"}}>{error}</p>}
 </main>;
}
