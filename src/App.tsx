import AgentCenter from "./AgentCenter";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Download,
  Heart,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  demoData,
  money,
  profit,
  projectNames,
  stages,
  STORAGE_KEY,
  validData,
  type Appointment,
  type Customer,
  type Data,
  type Finance,
} from "./data";
const nav = [
  { name: "工作台", icon: LayoutDashboard },
  { name: "客户管理", icon: Users },
  { name: "医疗项目", icon: Stethoscope },
  { name: "预约管理", icon: CalendarDays },
  { name: "财务管理", icon: Wallet },
  { name: "服务流程", icon: ClipboardList },
  { name: "渠道与佣金", icon: Wallet },
];
const descriptions = [
  "掌握业务全貌，让每一份托付都有回应。",
  "用心连接每一位客户，持续跟进服务进度。",
  "连接日本医疗资源，提供清晰、专业的服务。",
  "统筹医院预约与翻译安排，让行程井然有序。",
  "透明管理每一笔收支，清晰掌握业务收益。",
  "从第一次沟通到回国随访，全程用心陪伴。",
  "管理合作代理、订单返点与结算进度。",
];
type Modal =
  | { type: "customer"; item?: Customer }
  | { type: "appointment"; item?: Appointment }
  | { type: "finance"; item?: Finance }
  | { type: "detail"; item: Customer }
  | null;
function initialState(): { data: Data; warning: string } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return {
      data: demoData(),
      warning: "无法读取本地数据，当前使用临时演示数据。请检查浏览器存储权限。",
    };
  }
  if (!raw) return { data: demoData(), warning: "" };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (validData(parsed)) return { data: parsed, warning: "" };
  } catch {
    /* Preserve the original content for export and recovery. */
  }
  return {
    data: demoData(),
    warning:
      "本地数据损坏或格式不兼容，当前显示临时演示数据。请导出备份后重置；原始数据暂未覆盖。",
  };
}
export default function App() {
  const [initial] = useState(initialState);
  const [data, setData] = useState<Data>(initial.data);
  const [warning, setWarning] = useState(initial.warning);
  const preserve = useRef(!!initial.warning);
  const [page, setPage] = useState(0),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("全部项目"),
    [modal, setModal] = useState<Modal>(null),
    [mobile, setMobile] = useState(false),
    [toast, setToast] = useState(""),
    [notice, setNotice] = useState(false);
  useEffect(() => {
    if (preserve.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setWarning("");
    } catch {
      setWarning(
        "本次更改仅保存在内存中：浏览器存储不可用或空间不足，请导出数据备份。",
      );
    }
  }, [data]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const before = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLDivElement>('[role="dialog"]');
    const controls = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,[tabindex="0"]',
        ) ?? [],
      );
    controls()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab") {
        const list = controls();
        if (e.shiftKey && document.activeElement === list[0]) {
          e.preventDefault();
          list.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === list.at(-1)) {
          e.preventDefault();
          list[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      before?.focus();
    };
  }, [modal]);
  const go = (i: number) => {
    setPage(i);
    setSearch("");
    setFilter("全部项目");
    setMobile(false);
  };
  const name = (id: string) =>
    data.customers.find((c) => c.id === id)?.name ?? "未知客户";
  const active = data.customers.filter((c) => c.stage < 4);
  const pending = data.appointments.filter(
    (a) => !["已完成", "已取消"].includes(a.status),
  );
  const revenue = data.finances
    .filter((f) => f.status === "已收款")
    .reduce((s, f) => s + f.quote, 0);
  const totalProfit = data.finances
    .filter((f) => f.status === "已收款")
    .reduce((s, f) => s + profit(f), 0);
  const filtered = data.customers.filter(
    (c) =>
      (filter === "全部项目" || c.project === filter) &&
      [c.name, c.phone, c.city, c.owner, c.project]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const appointments = [...data.appointments]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((a) =>
      (name(a.customerId) + a.hospital + a.project + a.translator).includes(
        search,
      ),
    );
  function save(
    type: "customer" | "appointment" | "finance",
    item: Customer | Appointment | Finance,
  ) {
    const key =
      type === "customer"
        ? "customers"
        : type === "appointment"
          ? "appointments"
          : "finances";
    setData((d) => ({
      ...d,
      [key]: d[key].some((x) => x.id === item.id)
        ? d[key].map((x) => (x.id === item.id ? item : x))
        : [...d[key], item],
    }));
    setModal(null);
    setToast("已保存更改");
  }
  function exportData() {
    let content = JSON.stringify(data, null, 2);
    if (preserve.current) {
      try {
        content = localStorage.getItem(STORAGE_KEY) ?? content;
      } catch {
        /* export current memory */
      }
    }
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "Link Health-演示数据.json";
    a.click();
    URL.revokeObjectURL(url);
    setToast("数据已导出");
  }
  const badge = (text: string, kind = "") => (
    <span className={`badge ${kind}`}>{text}</span>
  );
  const customerTable = (rows: Customer[], compact = false) => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>客户姓名</th>
            <th>服务项目</th>
            <th>服务进度</th>
            <th>专属顾问</th>
            {!compact && <th>联系信息</th>}
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={c.id}>
              <td>
                <button
                  className="person"
                  onClick={() => setModal({ type: "detail", item: c })}
                >
                  <span className={`avatar a${i % 4}`}>{c.name[0]}</span>
                  <span>
                    <b>{c.name}</b>
                    <small>
                      {c.city} · {c.gender} · {c.age}岁
                    </small>
                  </span>
                </button>
              </td>
              <td>{c.project}</td>
              <td>
                {badge(stages[c.stage], `stage${c.stage}`)}
                <div className="mini-progress">
                  <i style={{ width: `${(c.stage + 1) * 20}%` }} />
                </div>
              </td>
              <td>
                <span className="owner-dot" />
                {c.owner}
              </td>
              {!compact && <td>{c.phone}</td>}
              <td>
                <button
                  className="text-button"
                  onClick={() => setModal({ type: "customer", item: c })}
                >
                  编辑 <ChevronRight size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <Empty text="未找到匹配的客户，请调整搜索条件或新增客户。" />
      )}
    </div>
  );
  return (
    <div className="app">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go(0);
          }}
        >
          <span className="brand-icon">
            <Activity size={27} />
          </span>
          <span>
            Link Health<small>日本跨境医疗服务</small>
          </span>
        </a>
        <div className="workspace-label">业务工作空间</div>
        <nav>
          {nav.map((n, i) => (
            <button
              key={n.name}
              className={page === i ? "active" : ""}
              onClick={() => go(i)}
            >
              <n.icon size={19} />
              {n.name}
              {i === 1 && (
                <span className="nav-count">{data.customers.length}</span>
              )}
              {page === i && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={22} />
          <b>让跨境医疗，更有温度</b>
          <p>
            连接专业资源，守护每一段
            <br />
            安心的赴日医疗旅程。
          </p>
          <span>专业 · 透明 · 陪伴</span>
        </div>
        <button
          className="help"
          onClick={() =>
            setToast("演示版：数据仅保存在当前浏览器；可在右上角导出备份。")
          }
        >
          <CircleHelp size={18} />
          使用帮助
          <ArrowUpRight size={14} />
        </button>
        <div className="sidebar-footer">
          <span className="user-avatar">李</span>
          <div>
            <b>李晓</b>
            <small>业务管理员 · 演示账号</small>
          </div>
          <MoreHorizontal size={18} />
        </div>
      </aside>
      {mobile && <div className="scrim" onClick={() => setMobile(false)} />}
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="打开导航"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={22} />
            </button>
            <span>工作空间</span>
            <ChevronRight size={14} />
            <b>{nav[page].name}</b>
          </div>
          <div className="top-actions">
            <span className="demo">
              <i />
              演示模式
            </span>
            <span className="top-divider" />
            <button
              className="icon-button notification"
              aria-label="查看待办通知"
              onClick={() => setNotice(!notice)}
            >
              <Bell size={19} />
              <i />
            </button>
            <span className="user-avatar small">李</span>
          </div>
          {notice && (
            <div className="notification-panel">
              <b>工作提醒</b>
              <p>
                有 {pending.filter((a) => a.status === "待确认").length}{" "}
                个预约待确认
              </p>
              <p>
                有 {data.finances.filter((f) => f.status === "待收款").length}{" "}
                笔报价待收款
              </p>
              <button
                className="text-button"
                onClick={() => {
                  go(3);
                  setNotice(false);
                }}
              >
                查看预约 <ArrowRight size={14} />
              </button>
            </div>
          )}
        </header>
        <main>
          <div className="demo-disclaimer" role="note">
            <ShieldCheck size={17} />
            <span>
              <b>测试体验版 · 仅限虚构资料</b>{" "}
              请勿录入真实患者信息。演示数据仅保存在当前浏览器，不会同步到其他设备。
            </span>
          </div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">Link Health · 业务管理中心</div>
              <h1>
                {page === 0 ? "工作台概览" : nav[page].name}
                <span className="heading-dot" />
              </h1>
              <p>{descriptions[page]}</p>
            </div>
            <div className="heading-actions">
              <button className="button" onClick={exportData}>
                <Download size={16} />
                导出数据
              </button>
              <button
                className="button primary"
                onClick={() =>
                  setModal({
                    type:
                      page === 3
                        ? "appointment"
                        : page === 4
                          ? "finance"
                          : "customer",
                  })
                }
              >
                <Plus size={17} />
                {page === 3
                  ? "新增预约"
                  : page === 4
                    ? "新增财务记录"
                    : "新增客户"}
              </button>
            </div>
          </div>
          {warning && (
            <div className="warning" role="alert">
              {warning}
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "确定重置为演示数据？现有本地数据将被替换，请先导出备份。",
                    )
                  ) {
                    preserve.current = false;
                    setData(demoData());
                    setToast("已重置演示数据");
                  }
                }}
              >
                重置演示数据
              </button>
            </div>
          )}
          {page === 6 && <AgentCenter />}
          {page === 0 && (
            <>
              <div className="welcome-strip">
                <div>
                  <span className="live-dot" />
                  <b>每一段安心旅程，从这里开始</b>
                  <span>今天也一起为客户提供更好的服务。</span>
                </div>
                <span>
                  {new Date().toLocaleDateString("zh-CN", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "long",
                  })}
                </span>
              </div>
              <div className="stats">
                <Stat
                  title="客户总数"
                  value={String(data.customers.length).padStart(2, "0")}
                  icon={<Users size={21} />}
                  note="全部已建档客户"
                />
                <Stat
                  title="进行中项目"
                  value={String(active.length).padStart(2, "0")}
                  icon={<ClipboardList size={21} />}
                  note="正在跟进的服务项目"
                  color="blue"
                />
                <Stat
                  title="待办预约"
                  value={String(pending.length).padStart(2, "0")}
                  icon={<CalendarDays size={21} />}
                  note="待确认及已确认预约"
                  color="orange"
                />
                <Stat
                  title="已收款收入"
                  value={money(revenue)}
                  icon={<Wallet size={21} />}
                  note={`对应利润 ${money(totalProfit)}`}
                  color="purple"
                />
              </div>
              <div className="dashboard-grid">
                <section className="panel customer-panel">
                  <PanelHeading
                    title="近期客户"
                    sub="以专业服务，回应每一份信任"
                    action="查看全部"
                    onClick={() => go(1)}
                  />
                  {customerTable(
                    [...data.customers]
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                      .slice(0, 5),
                    true,
                  )}
                  <div className="panel-bottom">
                    <span>
                      共 {data.customers.length} 位客户 · 展示最近建档的 5 位
                    </span>
                    <button className="text-button" onClick={() => go(1)}>
                      进入客户管理 <ArrowRight size={14} />
                    </button>
                  </div>
                </section>
                <section className="panel appointments-panel">
                  <PanelHeading
                    title="预约日程"
                    sub="即将到来的服务安排"
                    action="全部"
                    onClick={() => go(3)}
                  />
                  <div className="schedule-list">
                    {[...pending]
                      .filter(
                        (a) =>
                          a.date.slice(0, 10) >=
                          new Date().toLocaleDateString("sv-SE"),
                      )
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .slice(0, 3)
                      .map((a) => (
                        <button
                          className="schedule-item"
                          key={a.id}
                          onClick={() =>
                            setModal({ type: "appointment", item: a })
                          }
                        >
                          <div className="date-tile">
                            <b>{new Date(a.date).getDate()}</b>
                            <span>{new Date(a.date).getMonth() + 1}月</span>
                          </div>
                          <div>
                            <div className="schedule-title">
                              <b>{name(a.customerId)}</b>
                              {badge(
                                a.status,
                                a.status === "待确认" ? "orange" : "",
                              )}
                            </div>
                            <p>{a.project}</p>
                            <small>{a.hospital}</small>
                            <div className="schedule-time">
                              <CalendarDays size={12} />
                              {a.date.slice(11).replace("T", " ")}
                              <span>·</span>
                              {a.translator}
                            </div>
                          </div>
                        </button>
                      ))}
                    {!pending.some(
                      (a) =>
                        a.date.slice(0, 10) >=
                        new Date().toLocaleDateString("sv-SE"),
                    ) && <Empty text="暂无即将到来的预约" />}
                  </div>
                  <button
                    className="schedule-add"
                    onClick={() => setModal({ type: "appointment" })}
                  >
                    <Plus size={16} />
                    安排新的预约
                  </button>
                </section>
                <section className="panel">
                  <PanelHeading
                    title="服务进度概览"
                    sub="全流程跟进，让服务有迹可循"
                  />
                  <div className="stage-overview">
                    {stages.map((s, i) => (
                      <button key={s} onClick={() => go(5)}>
                        <span className={`step-icon stage${i}`}>
                          {i === 4 ? (
                            <Check size={16} />
                          ) : (
                            String(i + 1).padStart(2, "0")
                          )}
                        </span>
                        <b>
                          {data.customers.filter((c) => c.stage === i).length}
                          <small> 位</small>
                        </b>
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flow-foot">
                    <ShieldCheck size={14} />
                    每个阶段，都是一份安心的承诺
                  </div>
                </section>
                <section className="resource-card">
                  <div className="resource-icon">
                    <Heart size={24} />
                  </div>
                  <span className="eyebrow">专业资源 · 用心连接</span>
                  <h2>
                    连接日本医疗
                    <br />
                    陪伴每一步旅程
                  </h2>
                  <p>精密体检、医疗咨询与全程协调服务</p>
                  <button onClick={() => go(2)}>
                    探索医疗项目 <ArrowRight size={16} />
                  </button>
                  <div className="decor-circle one" />
                  <div className="decor-circle two" />
                </section>
              </div>
            </>
          )}
          {page === 1 && (
            <section className="panel">
              <div className="toolbar">
                <label className="search">
                  <Search size={17} />
                  <input
                    aria-label="搜索客户"
                    placeholder="搜索客户姓名、电话、城市或顾问…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label className="filter">
                  <Settings2 size={16} />
                  <select
                    aria-label="筛选医疗项目"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {["全部项目", ...projectNames].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <span className="muted">共 {filtered.length} 位客户</span>
              </div>
              {customerTable(filtered)}{" "}
            </section>
          )}
          {page === 2 && (
            <>
              <div className="project-grid">
                {projectNames.map((p, i) => (
                  <section className="panel project-card" key={p}>
                    <div className={`project-icon a${i}`}>
                      <Stethoscope size={26} />
                    </div>
                    {badge("服务项目", "neutral")}
                    <h2>{p}</h2>
                    <p>
                      {
                        [
                          "协调日本体检资源，提供行前指导、预约及报告整理服务。",
                          "协调专科咨询与评估，具体检测及治疗方案由具备资质的医院确认。",
                          "提供医疗机构咨询协调，适用性、风险及方案由医生独立评估。",
                          "统筹医疗咨询、翻译与在日行程，提供贴心的赴日服务体验。",
                        ][i]
                      }
                    </p>
                    <div className="project-meta">
                      <span>
                        服务中{" "}
                        <b>{active.filter((c) => c.project === p).length}</b>
                      </span>
                      <span>
                        累计客户{" "}
                        <b>
                          {data.customers.filter((c) => c.project === p).length}
                        </b>
                      </span>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        go(1);
                        setFilter(p);
                      }}
                    >
                      查看项目客户 <ArrowRight size={15} />
                    </button>
                  </section>
                ))}
              </div>
              <div className="info-note">
                <ShieldCheck size={18} />
                演示项目仅展示服务协调流程，不构成医疗建议或疗效承诺。所有机构及客户资料均为虚构。
              </div>
            </>
          )}
          {page === 3 && (
            <section className="panel">
              <div className="toolbar">
                <label className="search">
                  <Search size={17} />
                  <input
                    aria-label="搜索预约"
                    placeholder="搜索客户、医院、项目或翻译…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <span className="muted">
                  共 {appointments.length} 条预约 · 日期按日本当地时间记录
                </span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {[
                        "客户",
                        "医院 / 服务项目",
                        "预约日期（日本时间）",
                        "翻译安排",
                        "状态",
                        "操作",
                      ].map((t) => (
                        <th key={t}>{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <b>{name(a.customerId)}</b>
                        </td>
                        <td>
                          {a.hospital}
                          <small>{a.project}</small>
                        </td>
                        <td>{a.date.replace("T", " ")}</td>
                        <td>{a.translator || "待安排"}</td>
                        <td>
                          {badge(
                            a.status,
                            a.status === "待确认"
                              ? "orange"
                              : a.status === "已取消"
                                ? "neutral"
                                : "",
                          )}
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() =>
                              setModal({ type: "appointment", item: a })
                            }
                          >
                            编辑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!appointments.length && <Empty text="暂无匹配的预约" />}
              </div>
            </section>
          )}
          {page === 4 && (
            <>
              <div className="stats finance-stats">
                <Stat
                  title="报价总额"
                  value={money(data.finances.reduce((s, f) => s + f.quote, 0))}
                  icon={<Wallet size={21} />}
                  note="全部财务记录报价合计"
                />
                <Stat
                  title="已收款收入"
                  value={money(revenue)}
                  icon={<ArrowDownLeft size={21} />}
                  note="按人民币统一记录"
                  color="blue"
                />
                <Stat
                  title="已收款利润"
                  value={money(totalProfit)}
                  icon={<ArrowUpRight size={21} />}
                  note="报价 − 日方成本 − 服务支出"
                  color="purple"
                />
              </div>
              <section className="panel">
                <PanelHeading
                  title="财务明细"
                  sub="统一币种：人民币（CNY）；服务费按服务支出计算"
                />
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "客户",
                          "客户报价",
                          "日方成本",
                          "服务费支出",
                          "预计利润",
                          "收款状态",
                          "操作",
                        ].map((t) => (
                          <th key={t}>{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.finances.map((f) => (
                        <tr key={f.id}>
                          <td>
                            <b>{name(f.customerId)}</b>
                          </td>
                          <td>{money(f.quote)}</td>
                          <td>{money(f.cost)}</td>
                          <td>{money(f.fee)}</td>
                          <td
                            className={profit(f) < 0 ? "negative" : "positive"}
                          >
                            <b>{money(profit(f))}</b>
                          </td>
                          <td>
                            {badge(
                              f.status,
                              f.status === "待收款" ? "orange" : "",
                            )}
                          </td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() =>
                                setModal({ type: "finance", item: f })
                              }
                            >
                              编辑
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.finances.length && <Empty text="暂无财务记录" />}
                </div>
              </section>
            </>
          )}
          {page === 5 && (
            <div className="kanban">
              {stages.map((s, i) => (
                <section className="kanban-column" key={s}>
                  <h3>
                    <span className={`stage-dot stage${i}`} />
                    {s}
                    <span>
                      {data.customers.filter((c) => c.stage === i).length}
                    </span>
                  </h3>
                  {data.customers
                    .filter((c) => c.stage === i)
                    .map((c) => (
                      <div className="kanban-card" key={c.id}>
                        <button
                          className="person"
                          onClick={() => setModal({ type: "detail", item: c })}
                        >
                          <span className={`avatar a${i % 4}`}>
                            {c.name[0]}
                          </span>
                          <b>{c.name}</b>
                        </button>
                        <p>{c.project}</p>
                        <small>顾问：{c.owner}</small>
                        <div className="kanban-actions">
                          <button
                            disabled={i === 0}
                            onClick={() =>
                              save("customer", { ...c, stage: c.stage - 1 })
                            }
                          >
                            <ChevronLeft size={14} />
                            上一阶段
                          </button>
                          <button
                            disabled={i === 4}
                            onClick={() =>
                              save("customer", { ...c, stage: c.stage + 1 })
                            }
                          >
                            下一阶段
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  {!data.customers.some((c) => c.stage === i) && (
                    <div className="column-empty">暂无客户</div>
                  )}
                </section>
              ))}
            </div>
          )}
          <footer className="page-footer">
            <span>
              <ShieldCheck size={13} />
              虚构演示数据 · 仅保存在当前浏览器
            </span>
            <span>
              Link Health CRM <span className="version">第一版</span>
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-heading">
              <h2 id="modal-title">
                {modal.type === "detail"
                  ? "客户服务档案"
                  : `${modal.item ? "编辑" : "新增"}${modal.type === "customer" ? "客户" : modal.type === "appointment" ? "预约" : "财务记录"}`}
              </h2>
              <button
                className="icon-button"
                aria-label="关闭弹窗"
                onClick={() => setModal(null)}
              >
                <X size={21} />
              </button>
            </div>
            {modal.type === "detail" ? (
              <div className="detail">
                <div className="detail-profile">
                  <span className="avatar">{modal.item.name[0]}</span>
                  <h2>{modal.item.name}</h2>
                  {badge(stages[modal.item.stage])}
                </div>
                <dl>
                  {[
                    ["服务项目", modal.item.project],
                    ["城市", modal.item.city],
                    ["联系电话", modal.item.phone],
                    ["专属顾问", modal.item.owner],
                    ["建档日期", modal.item.createdAt],
                    ["备注", modal.item.notes || "暂无备注"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="detail-steps">
                  {stages.map((s, i) => (
                    <span
                      key={s}
                      className={i <= modal.item.stage ? "done" : ""}
                    >
                      <Check size={14} />
                      {s}
                    </span>
                  ))}
                </div>
                <button
                  className="button primary"
                  onClick={() =>
                    setModal({ type: "customer", item: modal.item })
                  }
                >
                  编辑档案
                </button>
              </div>
            ) : (
              <RecordForm
                modal={modal}
                customers={data.customers}
                onSave={save}
                onCancel={() => setModal(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <ClipboardList size={28} />
      <p>{text}</p>
    </div>
  );
}
function Stat({
  title,
  value,
  icon,
  note,
  color = "green",
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  note: string;
  color?: string;
}) {
  return (
    <section className="stat panel">
      <div className="stat-top">
        <span>{title}</span>
        <span className={`stat-icon ${color}`}>{icon}</span>
      </div>
      <strong>{value}</strong>
      <div className="stat-note">
        <span className="stat-dash" />
        {note}
      </div>
    </section>
  );
}
function PanelHeading({
  title,
  sub,
  action,
  onClick,
}: {
  title: string;
  sub: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      {action && (
        <button className="text-button" onClick={onClick}>
          {action}
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
function RecordForm({
  modal,
  customers,
  onSave,
  onCancel,
}: {
  modal: Exclude<Modal, null | { type: "detail"; item: Customer }>;
  customers: Customer[];
  onSave: (
    type: "customer" | "appointment" | "finance",
    item: Customer | Appointment | Finance,
  ) => void;
  onCancel: () => void;
}) {
  const [quote, setQuote] = useState(
      modal.type === "finance" ? (modal.item?.quote ?? 0) : 0,
    ),
    [cost, setCost] = useState(
      modal.type === "finance" ? (modal.item?.cost ?? 0) : 0,
    ),
    [fee, setFee] = useState(
      modal.type === "finance" ? (modal.item?.fee ?? 0) : 0,
    );
  const c = modal.type === "customer" ? modal.item : undefined,
    a = modal.type === "appointment" ? modal.item : undefined,
    f = modal.type === "finance" ? modal.item : undefined;
  const customerSelect = (
    <label>
      关联客户
      <select
        name="customerId"
        defaultValue={a?.customerId ?? f?.customerId ?? customers[0]?.id}
        required
      >
        <option value="" disabled>
          请选择客户
        </option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const values = new FormData(e.currentTarget);
        const s = (key: string) => String(values.get(key) ?? "").trim();
        if (modal.type === "customer") {
          if (!s("name") || !s("owner") || !s("city") || !s("phone")) return;
          onSave("customer", {
            id: c?.id ?? crypto.randomUUID(),
            name: s("name"),
            gender: s("gender"),
            age: Number(s("age")),
            phone: s("phone"),
            city: s("city"),
            project: s("project"),
            stage: Number(s("stage")),
            owner: s("owner"),
            notes: s("notes"),
            createdAt: c?.createdAt ?? new Date().toISOString().slice(0, 10),
          });
        } else if (modal.type === "appointment") {
          if (!s("hospital")) return;
          onSave("appointment", {
            id: a?.id ?? crypto.randomUUID(),
            customerId: s("customerId"),
            hospital: s("hospital"),
            date: s("date"),
            project: s("project"),
            translator: s("translator") || "待安排",
            status: s("status") as Appointment["status"],
          });
        } else {
          onSave("finance", {
            id: f?.id ?? crypto.randomUUID(),
            customerId: s("customerId"),
            quote,
            cost,
            fee,
            status: s("status") as Finance["status"],
          });
        }
      }}
    >
      <div className="form-body">
        <div className="form-note">
          本系统为演示版本，请仅填写虚构资料。标有 * 的字段为必填。
        </div>
        <div className="form-grid">
          {modal.type === "customer" ? (
            <>
              <label>
                客户姓名 *
                <input
                  name="name"
                  required
                  maxLength={40}
                  pattern=".*\S.*"
                  defaultValue={c?.name}
                  placeholder="例如：林悦（演示）"
                />
              </label>
              <label>
                性别
                <select name="gender" defaultValue={c?.gender ?? "女"}>
                  {["女", "男", "未填写"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                年龄 *
                <input
                  name="age"
                  type="number"
                  required
                  min="0"
                  max="120"
                  defaultValue={c?.age ?? 35}
                />
              </label>
              <label>
                所在城市 *
                <input
                  name="city"
                  required
                  pattern=".*\S.*"
                  maxLength={40}
                  defaultValue={c?.city}
                />
              </label>
              <label>
                联系电话 *
                <input
                  name="phone"
                  required
                  pattern=".*\S.*"
                  maxLength={40}
                  defaultValue={c?.phone}
                  placeholder="请填写虚构号码"
                />
              </label>
              <label>
                专属顾问 *
                <input
                  name="owner"
                  required
                  pattern=".*\S.*"
                  maxLength={30}
                  defaultValue={c?.owner ?? "李晓"}
                />
              </label>
              <label>
                服务项目
                <select name="project" defaultValue={c?.project}>
                  {projectNames.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                服务阶段
                <select name="stage" defaultValue={c?.stage ?? 0}>
                  {stages.map((s, i) => (
                    <option key={s} value={i}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full">
                服务备注
                <textarea
                  name="notes"
                  rows={3}
                  maxLength={1000}
                  defaultValue={c?.notes}
                  placeholder="服务需求、待办事项等（仅填写虚构信息）"
                />
              </label>
            </>
          ) : modal.type === "appointment" ? (
            <>
              {customerSelect}
              <label>
                医院名称 *
                <input
                  name="hospital"
                  required
                  pattern=".*\S.*"
                  maxLength={100}
                  defaultValue={a?.hospital}
                  placeholder="请输入虚构医院名称"
                />
              </label>
              <label>
                预约日期（日本时间）*
                <input
                  name="date"
                  type="datetime-local"
                  required
                  defaultValue={a?.date}
                />
              </label>
              <label>
                服务项目
                <select name="project" defaultValue={a?.project}>
                  {projectNames.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                翻译安排
                <input
                  name="translator"
                  maxLength={60}
                  defaultValue={a?.translator}
                  placeholder="未填写则标记为待安排"
                />
              </label>
              <label>
                预约状态
                <select name="status" defaultValue={a?.status ?? "待确认"}>
                  {["待确认", "已确认", "已完成", "已取消"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              {customerSelect}
              <label>
                收款状态
                <select name="status" defaultValue={f?.status ?? "待收款"}>
                  <option>待收款</option>
                  <option>已收款</option>
                </select>
              </label>
              <label>
                客户报价（人民币）*
                <input
                  type="number"
                  min="0"
                  max="1000000000"
                  step="0.01"
                  required
                  value={quote}
                  onChange={(e) => setQuote(Number(e.target.value))}
                />
              </label>
              <label>
                日方成本（人民币）*
                <input
                  type="number"
                  min="0"
                  max="1000000000"
                  step="0.01"
                  required
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                />
              </label>
              <label>
                服务费支出（人民币）*
                <input
                  type="number"
                  min="0"
                  max="1000000000"
                  step="0.01"
                  required
                  value={fee}
                  onChange={(e) => setFee(Number(e.target.value))}
                />
              </label>
              <div className="profit-box">
                <small>预计利润</small>
                <strong
                  className={quote - cost - fee < 0 ? "negative" : "positive"}
                >
                  {money(quote - cost - fee)}
                </strong>
              </div>
              <p className="full form-note">
                利润 = 客户报价 − 日方成本 −
                服务费支出。日方成本请按实际汇率换算为人民币后录入；收款状态不代表净利润已结算。
              </p>
            </>
          )}
        </div>
        {!customers.length && modal.type !== "customer" && (
          <p className="negative">请先新增客户，再创建关联记录。</p>
        )}
      </div>
      <div className="form-footer">
        <button type="button" className="button" onClick={onCancel}>
          取消
        </button>
        <button
          type="submit"
          className="button primary"
          disabled={!customers.length && modal.type !== "customer"}
        >
          <Check size={16} />
          保存
          {modal.type === "customer"
            ? "客户"
            : modal.type === "appointment"
              ? "预约"
              : "记录"}
        </button>
      </div>
    </form>
  );
}
