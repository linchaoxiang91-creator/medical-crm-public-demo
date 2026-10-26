# Link Health V3 免费云端试运营：部署操作

本分支实现独立入口 `/#pilot`。未配置环境变量时显示“尚未连接数据库”，不会模拟登录成功。原演示主页不变。

## 连接 Supabase（须由项目所有者完成）
1. 注册或登录 Supabase，创建**私有测试项目**，记录 Project URL 和 **publishable/anon key**。不要使用 service_role 或 secret key。
2. 在 SQL Editor 执行 `supabase/pilot.sql`，仅用于虚构数据测试。
3. 在 Authentication 中禁用公开注册；由项目管理员在控制台创建四个已验证账号，并在 `public.pilot_profiles` 中通过安全的 SQL 管理操作插入 1 个 admin 和 3 个 agent 的 auth user UUID、名称和 active=true。不要把账号密码写进仓库。
4. 在 GitHub 仓库 Actions 的部署工作流中将 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 作为 build 环境变量注入（publishable/anon key 是公开前端凭据，安全边界必须依赖 RLS）。配置正确后访问 `https://linchaoxiang91-creator.github.io/medical-crm-public-demo/#pilot`。
5. 使用四个虚构账号逐一测试：A 不可读取 B 的记录，B 不可读取 A 的记录，管理员可读全部；停用账号后重新请求应拒绝；测试新增、刷新、退出和金额校验。
6. 通过测试后再考虑迁移到独立试运营域名。正式客户上线需要隐私合规审查、备份、审计、账号恢复、MFA、存储地域选择及真实数据安全评估。

## 已知限制
- 当前仅支持虚构客户代号、项目、进度和模拟财务数字；**不提供真实客户个人信息录入、病历上传或日本报告授权**。
- 登录 token 只存于页面内存，刷新页面需要重新登录；初期安全优先。
- 测试版财务数字由代理填写，不具备正式审批、会计凭证、退款或防篡改审计功能。
- RLS 是关键安全层，但需在独立项目中执行跨账号集成测试，不能只依赖前端过滤。
- 免费额度、地区和实际服务条款以 Supabase 官方控制台为准。
