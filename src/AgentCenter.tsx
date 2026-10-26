import { useEffect, useState } from "react";
type Rule = { id: string; partner: string; project: string; kind: "比例" | "固定"; value: number; base: "实收金额" | "约定金额"; active: boolean };
type Order = { id: string; customer: string; partner: string; project: string; amount: number; received: number; completed: boolean; status: "预计" | "待审核" | "待结算" | "已结算" | "暂停结算"; override?: number; snapshot?: { kind: "比例" | "固定"; value: number; base: string } };
const partners = [{name:"太平保险合作顾问（示例）",type:"保险代理人"},{name:"关西健康管理机构（示例）",type:"机构"},{name:"独立健康顾问（示例）",type:"个人"}];
const initialRules: Rule[] = [
  {id:"R01",partner:partners[0].name,project:"日本精密体检",kind:"比例",value:8,base:"实收金额",active:true},
  {id:"R02",partner:partners[1].name,project:"专科会诊",kind:"固定",value:1800,base:"约定金额",active:true},
  {id:"R03",partner:partners[2].name,project:"肠道健康管理",kind:"比例",value:12,base:"实收金额",active:true},
];
const initialOrders: Order[] = [
  {id:"LH-001",customer:"演示客户 A",partner:partners[0].name,project:"日本精密体检",amount:30000,received:30000,completed:true,status:"待审核",snapshot:{kind:"比例",value:8,base:"实收金额"}},
  {id:"LH-002",customer:"演示客户 B",partner:partners[1].name,project:"专科会诊",amount:20000,received:20000,completed:true,status:"待结算",snapshot:{kind:"固定",value:1800,base:"约定金额"}},
  {id:"LH-003",customer:"演示客户 C",partner:partners[2].name,project:"肠道健康管理",amount:36000,received:10000,completed:false,status:"预计",snapshot:{kind:"比例",value:12,base:"实收金额"}},
];
export function commission(order: Order) {
  if (!order.snapshot) return 0;
  const value = order.override ?? (order.snapshot.kind === "固定" ? order.snapshot.value : (order.snapshot.base === "实收金额" ? order.received : order.amount) * order.snapshot.value / 100);
  return Math.max(0,Math.round(value * 100)/100);
}
const STORE = "link-health-agent-demo-v2";
function readSaved(): {rules:Rule[];orders:Order[]} | null {
  try {
    const raw=localStorage.getItem(STORE);
    if (!raw) return null;
    const parsed:unknown=JSON.parse(raw);
    if (!parsed || typeof parsed!=="object") return null;
    const p=parsed as {rules?:unknown;orders?:unknown};
    if (!Array.isArray(p.rules)||!Array.isArray(p.orders)) return null;
    if (!p.rules.every((r:unknown)=>r&&typeof r==="object"&&typeof (r as Rule).partner==="string"&&typeof (r as Rule).value==="number"&&["比例","固定"].includes((r as Rule).kind))) return null;
    if (!p.orders.every((o:unknown)=>o&&typeof o==="object"&&typeof (o as Order).customer==="string"&&typeof (o as Order).received==="number"&&typeof (o as Order).amount==="number")) return null;
    return {rules:p.rules as Rule[],orders:p.orders as Order[]};
  } catch { return null; }
}
const currency=(n:number)=>"¥"+n.toLocaleString("zh-CN",{maximumFractionDigits:2});
export default function AgentCenter() {
  const [saved] = useState(readSaved);
  const [rules,setRules]=useState<Rule[]>(saved?.rules??initialRules);
  const [orders,setOrders]=useState<Order[]>(saved?.orders??initialOrders);
  const [customer,setCustomer]=useState("");
  const [orderPartner,setOrderPartner]=useState(partners[0].name);
  const [orderProject,setOrderProject]=useState("日本精密体检");
  const [orderAmount,setOrderAmount]=useState("30000");
  const [orderReceived,setOrderReceived]=useState("0");
  const [completed,setCompleted]=useState(false);
  useEffect(()=>{
    try { localStorage.setItem(STORE,JSON.stringify({rules,orders})); }
    catch { setMessage("浏览器无法保存演示数据，请检查存储设置。"); }
  },[rules,orders]);
  const [role,setRole]=useState("平台管理员");
  const [partner,setPartner]=useState(partners[0].name);
  const [newPartner,setNewPartner]=useState(partners[0].name);
  const [newProject,setNewProject]=useState("日本精密体检");
  const [kind,setKind]=useState<"比例"|"固定">("比例");
  const [value,setValue]=useState("8");
  const [message,setMessage]=useState("");
  const visible=role==="平台管理员"?orders:orders.filter(o=>o.partner===partner);
  const update=(id:string,changes:Partial<Order>)=>setOrders(prev=>prev.map(o=>o.id===id?{...o,...changes}:o));
  function addOrder() {
    const amount=Number(orderAmount), received=Number(orderReceived);
    if (!customer.trim() || customer.trim().length>60 || !Number.isFinite(amount) || amount<=0 || !Number.isFinite(received) || received<0 || received>amount) {
      setMessage("请输入演示客户代号和有效金额，实收金额不能超过订单金额。");return;
    }
    const rule=[...rules].reverse().find(r=>r.active&&r.partner===orderPartner&&r.project===orderProject);
    const order:Order={
      id:"LH-"+Date.now(),customer:customer.trim(),partner:orderPartner,project:orderProject,
      amount,received,completed,status:completed&&received>0?"待审核":"预计",
      snapshot:rule?{kind:rule.kind,value:rule.value,base:rule.base}:undefined
    };
    setOrders(prev=>[...prev,order]);
    setCustomer("");
    setMessage(rule?"已新增演示订单并锁定当前佣金规则。":"订单已创建，但此代理与项目没有有效佣金规则，佣金暂为零。");
  }
  const total=visible.reduce((sum,o)=>sum+commission(o),0);
  return <div className="agent-center">
    <section className="panel" style={{padding:20,marginBottom:16}}>
      <h2>渠道代理与佣金中心 <span className="badge">V2 功能演示</span></h2>
      <p>仅使用虚构客户和渠道。这里的角色切换只是界面预览，不是安全登录或真实权限隔离。</p>
      <div className="agent-controls">
        <label>预览身份 <select value={role} onChange={e=>setRole(e.target.value)}><option>平台管理员</option><option>代理工作台</option></select></label>
        {role!=="平台管理员"&&<label>演示代理 <select value={partner} onChange={e=>setPartner(e.target.value)}>{partners.map(p=><option key={p.name}>{p.name}</option>)}</select></label>}
      </div>
      <div className="agent-metrics"><div><small>可见订单</small><strong>{visible.length}</strong></div><div><small>预计佣金合计</small><strong>{currency(total)}</strong></div><div><small>待审核</small><strong>{visible.filter(o=>o.status==="待审核").length}</strong></div><div><small>已结算</small><strong>{visible.filter(o=>o.status==="已结算").length}</strong></div></div>
    </section>
    {role==="平台管理员"&&<section className="panel" style={{padding:20,marginBottom:16}}>
      <h3>合作代理及佣金规则</h3>
      <div className="table-scroll"><table><thead><tr><th>代理 / 机构</th><th>服务项目</th><th>返点方式</th><th>计佣规则</th><th>状态</th></tr></thead><tbody>{rules.map(r=><tr key={r.id}><td>{r.partner}</td><td>{r.project}</td><td>{r.kind==="比例"?r.value+"%":currency(r.value)}</td><td>{r.base}</td><td>{r.active?"有效":"停用"}</td></tr>)}</tbody></table></div>
      <h4>新增项目返点规则（演示）</h4>
      <div className="agent-controls"><label>合作代理<select value={newPartner} onChange={e=>setNewPartner(e.target.value)}>{partners.map(p=><option key={p.name}>{p.name}</option>)}</select></label><label>服务项目<select value={newProject} onChange={e=>setNewProject(e.target.value)}>{["日本精密体检","专科会诊","肠道健康管理","其他服务"].map(p=><option key={p}>{p}</option>)}</select></label><label>方式<select value={kind} onChange={e=>setKind(e.target.value as "比例"|"固定")}><option>比例</option><option>固定</option></select></label><label>{kind==="比例"?"比例（%）":"金额（元）"}<input type="number" min="0" max={kind==="比例"?100:10000000} value={value} onChange={e=>setValue(e.target.value)}/></label><button className="button primary" onClick={()=>{const n=Number(value);if(!Number.isFinite(n)||n<0||(kind==="比例"&&n>100)){setMessage("请输入有效返点金额或0～100的比例");return;}setRules(prev=>[...prev,{id:"R"+Date.now(),partner:newPartner,project:newProject,kind,value:n,base:kind==="比例"?"实收金额":"约定金额",active:true}]);setMessage("已添加演示规则；历史订单不受影响。");}}>添加规则</button></div>
    </section>}
    {role==="平台管理员"&&<section className="panel" style={{padding:20,marginBottom:16}}>
      <h3>新增客户服务订单（虚构数据）</h3>
      <p>创建时自动匹配最新有效返点规则，并把规则快照保存在该订单中。</p>
      <div className="agent-controls">
        <label>演示客户代号<input value={customer} maxLength={60} placeholder="例如：演示客户 D" onChange={e=>setCustomer(e.target.value)}/></label>
        <label>推荐代理<select value={orderPartner} onChange={e=>setOrderPartner(e.target.value)}>{partners.map(p=><option key={p.name}>{p.name}</option>)}</select></label>
        <label>服务项目<select value={orderProject} onChange={e=>setOrderProject(e.target.value)}>{["日本精密体检","专科会诊","肠道健康管理","其他服务"].map(p=><option key={p}>{p}</option>)}</select></label>
        <label>订单金额（元）<input type="number" min="1" value={orderAmount} onChange={e=>setOrderAmount(e.target.value)}/></label>
        <label>实际收款（元）<input type="number" min="0" value={orderReceived} onChange={e=>setOrderReceived(e.target.value)}/></label>
        <label>服务状态<select value={completed?"已完成":"进行中"} onChange={e=>setCompleted(e.target.value==="已完成")}><option>进行中</option><option>已完成</option></select></label>
        <button className="button primary" onClick={addOrder}>新增演示订单</button>
      </div>
    </section>}
    <section className="panel" style={{padding:20}}>
      <h3>{role==="平台管理员"?"订单佣金审核台账":"我的客户与佣金"}</h3>
      <div className="table-scroll"><table><thead><tr><th>订单 / 客户</th><th>项目</th><th>服务进度</th><th>实收金额</th><th>佣金</th><th>结算状态</th>{role==="平台管理员"&&<th>审核操作</th>}</tr></thead><tbody>{visible.map(o=><tr key={o.id}><td>{o.id}<br/>{o.customer}</td><td>{o.project}</td><td>{o.completed?"服务完成":"服务中"}</td><td>{currency(o.received)}</td><td>{currency(commission(o))}</td><td>{o.status}</td>{role==="平台管理员"&&<td><select aria-label={o.id+"佣金状态"} value={o.status} onChange={e=>{const next=e.target.value as Order["status"];if((next==="待结算"||next==="已结算")&&(!o.completed||o.received<=0)){setMessage("服务未完成或尚未收款，不可结算。");return;}update(o.id,{status:next});setMessage(o.id+" 已更新为 "+next+"（仅演示）");}}>{["预计","待审核","待结算","已结算","暂停结算"].map(s=><option key={s}>{s}</option>)}</select></td>}</tr>)}</tbody></table></div>
      <p className="agent-footnote">演示规则：佣金按订单保存的规则快照计算；变更规则不追溯历史订单。实际结算需另行核验协议、收款、退款及适用合规要求。</p>
      {message&&<p role="status">{message}</p>}
      {role==="平台管理员"&&<button className="button" onClick={()=>{
        if (!window.confirm("重置渠道与佣金演示数据？当前浏览器中的演示修改会丢失。")) return;
        setRules(initialRules);setOrders(initialOrders);setMessage("已恢复虚构演示数据。");
      }}>重置渠道演示数据</button>}
    </section>
  </div>;
}
