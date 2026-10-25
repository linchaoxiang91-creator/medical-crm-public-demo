import { describe, expect, it } from "vitest";
import { demoData, profit, validData } from "./data";
describe("演示数据与财务口径", () => {
  it("演示数据可验证且所有预约及财务均关联客户", () => {
    const d = demoData();
    expect(validData(d)).toBe(true);
    expect(d.customers.length).toBe(8);
    expect(d.appointments.length).toBe(4);
    expect(d.finances.length).toBe(6);
  });
  it("利润扣除日方成本及服务费支出，保留亏损", () => {
    const base = { id: "f", customerId: "c", status: "已收款" as const };
    expect(profit({ ...base, quote: 30000, cost: 18000, fee: 2000 })).toBe(
      10000,
    );
    expect(profit({ ...base, quote: 100, cost: 120, fee: 20 })).toBe(-40);
  });
  it("拒绝损坏的数据、非法阶段和负数成本", () => {
    expect(validData(null)).toBe(false);
    expect(validData({ customers: [] })).toBe(false);
    const d = demoData();
    d.customers[0].stage = 8;
    expect(validData(d)).toBe(false);
    const e = demoData();
    e.finances[0].cost = -1;
    expect(validData(e)).toBe(false);
  });
  it("拒绝悬空客户关系与无效预约日期", () => {
    const d = demoData();
    d.appointments[0].customerId = "missing";
    expect(validData(d)).toBe(false);
    const e = demoData();
    e.appointments[0].date = "无效日期";
    expect(validData(e)).toBe(false);
  });
  it("通过 JSON 序列化往返保留数据，独立初始化互不污染", () => {
    const d = demoData();
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
    d.customers[0].name = "已修改";
    expect(demoData().customers[0].name).not.toBe("已修改");
  });
});
