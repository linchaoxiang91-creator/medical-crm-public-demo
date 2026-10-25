export const stages = [
  "初次咨询",
  "病例整理",
  "医院预约",
  "赴日服务",
  "回国随访",
] as const;
export const projectNames = [
  "日本精密体检",
  "肠道菌群检测与移植",
  "再生医疗咨询",
  "医疗旅游",
];
export type Customer = {
  id: string;
  name: string;
  gender: string;
  age: number;
  phone: string;
  city: string;
  project: string;
  stage: number;
  owner: string;
  notes: string;
  createdAt: string;
};
export type Appointment = {
  id: string;
  customerId: string;
  hospital: string;
  date: string;
  project: string;
  translator: string;
  status: "待确认" | "已确认" | "已完成" | "已取消";
};
export type Finance = {
  id: string;
  customerId: string;
  quote: number;
  cost: number;
  fee: number;
  status: "待收款" | "已收款";
};
export type Data = {
  customers: Customer[];
  appointments: Appointment[];
  finances: Finance[];
};
export const money = (n: number) =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
export const profit = (f: Finance) =>
  Math.round((f.quote - f.cost - f.fee) * 100) / 100;
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function demoData(): Data {
  const names = [
    "林悦（演示）",
    "陈远（演示）",
    "苏宁（演示）",
    "周岚（演示）",
    "许安（演示）",
    "沈清（演示）",
    "顾言（演示）",
    "唐禾（演示）",
  ];
  return {
    customers: names.map((name, i) => ({
      id: `c${i + 1}`,
      name,
      gender: i % 2 ? "男" : "女",
      age: 32 + i * 3,
      phone: `演示号码 000-${1000 + i}`,
      city: ["上海", "北京", "杭州", "深圳"][i % 4],
      project: projectNames[i % 4],
      stage: [2, 3, 1, 0, 4, 2, 1, 4][i],
      owner: ["李晓", "王宁", "张敏"][i % 3],
      notes: "仅用于产品功能演示，无真实患者资料。",
      createdAt: day(-i * 3 - 2),
    })),
    appointments: [0, 1, 2, 5].map((i, j) => ({
      id: `a${j}`,
      customerId: `c${i + 1}`,
      hospital: [
        "东京国际健康中心（虚构）",
        "大阪未来医疗中心（虚构）",
        "京都健康诊所（虚构）",
        "东京国际健康中心（虚构）",
      ][j],
      date: `${day(j === 0 ? 0 : j * 2)}T${["09:30", "14:00", "10:00", "13:30"][j]}`,
      project: projectNames[i % 4],
      translator: [
        "田中美咲（演示）",
        "待安排",
        "佐藤遥（演示）",
        "田中美咲（演示）",
      ][j],
      status: j === 1 ? "待确认" : "已确认",
    })),
    finances: names
      .slice(0, 6)
      .map((_, i) => ({
        id: `f${i}`,
        customerId: `c${i + 1}`,
        quote: [28000, 58000, 36000, 22000, 32000, 68000][i],
        cost: [16000, 38000, 21000, 12000, 18000, 45000][i],
        fee: 2000 + i * 300,
        status: i % 3 === 0 ? "待收款" : "已收款",
      })),
  };
}
export const STORAGE_KEY = "heqiao-medical-crm-v1";
export function validData(value: unknown): value is Data {
  if (!value || typeof value !== "object") return false;
  const d = value as Data;
  return (
    Array.isArray(d.customers) &&
    Array.isArray(d.appointments) &&
    Array.isArray(d.finances) &&
    d.customers.every(
      (c) =>
        c &&
        typeof c.id === "string" &&
        typeof c.name === "string" &&
        typeof c.project === "string" &&
        typeof c.phone === "string" &&
        typeof c.city === "string" &&
        typeof c.owner === "string" &&
        typeof c.notes === "string" &&
        typeof c.createdAt === "string" &&
        typeof c.gender === "string" &&
        Number.isFinite(c.age) &&
        Number.isInteger(c.stage) &&
        c.stage >= 0 &&
        c.stage < 5,
    ) &&
    d.appointments.every(
      (a) =>
        a &&
        typeof a.id === "string" &&
        d.customers.some((c) => c.id === a.customerId) &&
        typeof a.hospital === "string" &&
        typeof a.date === "string" &&
        Number.isFinite(Date.parse(a.date)) &&
        typeof a.project === "string" &&
        typeof a.translator === "string" &&
        ["待确认", "已确认", "已完成", "已取消"].includes(a.status),
    ) &&
    d.finances.every(
      (f) =>
        f &&
        typeof f.id === "string" &&
        d.customers.some((c) => c.id === f.customerId) &&
        [f.quote, f.cost, f.fee].every(
          (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
        ) &&
        ["待收款", "已收款"].includes(f.status),
    )
  );
}
