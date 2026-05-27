# 游戏公司财务费用分析可视化平台 — AI 接手指南

## 项目概述

这是一个**纯前端**的游戏公司财务费用分析可视化工具。用户拖拽 Excel 费用表格到页面，系统在浏览器本地完成解析、清洗、标准化、筛选和多维度图表分析。面向老板/CFO，不依赖后端、数据库或登录。

**一句话总结**：Excel → 浏览器本地解析 → 全中文仪表盘可视化报表。

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 构建 | Vite 8 + React 19 + TypeScript 6 | 纯静态产物，可部署到任意静态站点 |
| Excel 解析 | xlsx (SheetJS) | 浏览器端读取 .xlsx/.xls |
| 图表 | ECharts + echarts-for-react | 保持浅色克制风格 |
| 状态管理 | Zustand | 全局筛选状态 + 数据 Store |
| 日期 | date-fns | 日期范围、格式化等 |
| 持久化 | localStorage + IndexedDB (idb-keyval) | 保存视图 + 可选数据缓存 |
| 测试 | Vitest + fast-check + @testing-library/react | 属性测试验证正确性 |

## 快速启动

```bash
npm install
npm run dev      # 本地开发
npm run build    # 产出 dist/ 纯静态文件
npm run preview  # 预览构建产物
npm run lint     # 代码检查
```

## 目录结构（目标）

```
src/
├── App.tsx                    # 入口，按 importPhase 切换上传/预览/仪表盘
├── main.tsx                   # Vite 入口
├── index.css                  # 全局样式（CSS 变量）
├── types/
│   ├── expense.ts             # ExpenseRecord, FilterState 等核心类型
│   └── chart.ts              # 图表相关类型（KpiResult, TrendPoint 等）
├── data/
│   ├── headerAliases.ts      # 表头中英文别名映射
│   ├── parser.ts             # Excel 读取 + 表头识别
│   ├── normalizer.ts         # 数据标准化（日期/币种/汇率/状态判定）
│   └── selectors.ts          # 所有聚合计算（filter, kpi, trend, category...）
├── state/
│   ├── store.ts              # Zustand 主 Store
│   ├── filterActions.ts      # 筛选联动逻辑
│   └── persistence.ts        # IndexedDB + localStorage 持久化
├── utils/
│   ├── dateUtils.ts          # 日期工具（粒度选择、时间窗口、范围生成）
│   ├── currencyUtils.ts      # 币种展示格式化
│   └── constants.ts          # 常量（默认汇率 7.2、颜色等）
├── theme/
│   └── echarts.ts            # ECharts 自定义主题（配色/tooltip 中文）
├── components/
│   ├── Layout.tsx            # 三栏布局
│   ├── UploadDropzone.tsx    # 拖拽上传
│   ├── ImportPreview.tsx     # 导入预览（行数统计/字段映射）
│   ├── FilterPanel.tsx       # 筛选面板
│   ├── FilterTags.tsx        # 筛选标签
│   ├── CalendarPanel.tsx     # 日历（年/月/日/区间）
│   ├── KpiCards.tsx          # 四个 KPI 卡片
│   ├── TrendOverview.tsx     # 费用趋势柱状图
│   ├── CumulativeAnalysis.tsx# 累计分析
│   ├── CategoryDistribution.tsx # 费用结构半环图
│   ├── CategoryDrill.tsx     # 分类钻取（L1→L2→L3）
│   ├── DepartmentRanking.tsx # 部门排行
│   ├── DepartmentDetail.tsx  # 部门详情
│   ├── ExpenseTable.tsx      # 明细数据表
│   ├── Heatmap.tsx           # 费用热力图
│   ├── DetailDrawer.tsx      # 右侧详情抽屉
│   └── SavedViews.tsx        # 保存/恢复筛选视图
```

## 核心数据流

```
用户拖入 Excel
  → parser.ts: xlsx 解析 + 表头识别
  → normalizer.ts: 日期/币种/汇率标准化 + 状态判定
  → store.ts: 存入 records[]
  → selectors.ts: 根据 FilterState 聚合计算
  → 各图表组件消费计算结果
```

## 关键设计决策

### 1. 筛选状态是全局单一来源

所有图表、KPI、明细表、日历、抽屉都读同一个 `FilterState`。任何交互（点击柱子、选日历、改筛选面板）都通过 Zustand Store 更新 FilterState，全页响应式刷新。

### 2. 时间筛选有优先级

`date`（精确日）> `dateStart/dateEnd`（区间）> `period`（年/月）。互斥关系：设置高优先级时自动清空低优先级。

### 3. 币种口径 ≠ 币种筛选

- `currencyMode`：展示口径（全部数据按 CNY 还是 USD 展示金额）
- `currency`：交易币种筛选（只看 RMB 交易 / 只看 USD 交易）

### 4. 分类分布的计算口径

费用结构分布排除当前的 category 筛选条件再聚合，这样即使选了某个分类，半环图仍然展示完整占比。部门排行同理。

### 5. 导入状态三态互斥

每条记录恰好是 `normal`（有效且已分类）/ `pending_classify`（金额有效但缺分类）/ `abnormal`（数据本身有问题）之一。

## 正确性属性（Property-Based Testing）

项目使用 fast-check 验证以下不变量：

1. **表头别名识别**：任意已知别名都能正确映射到标准字段
2. **日期标准化往返**：标准化后的日期 periodMonth === date.slice(0,7)
3. **币种归一**：RMB/CNY/人民币 → RMB，USD/美元 → USD
4. **金额计算**：amountCNY = amount × exchangeRate（容忍 ±0.01）
5. **状态判定互斥穷尽**：三种状态恰一
6. **筛选时间优先级**：date 设置时 period/dateRange 被清空
7. **筛选重置等价**：清空所有筛选 = 返回全量数据
8. **币种展示格式**：CNY 模式输出 ¥X.X万，USD 模式输出 $X.X万
9. **币种过滤正确性**：currency='RMB' 筛选后结果只含 RMB 记录
10. **KPI 不变量**：confirmedExpense + pendingAmount ≤ totalTransaction
11. **趋势粒度自动选择**：选年→月粒度，选月→日粒度
12. **累计粒度选择**：≤62 天→日，≤190 天→周，更长→月
13. **分类分布占比和为 1**（容忍浮点 ±0.001）
14. **部门排行降序**：每个元素 ≥ 下一个
15. **视图保存往返**：save → load 后 FilterState 完全一致
16. **数据缓存往返**：cache → load 后 records 完全一致

## UI 风格约束

- 浅灰/米白大背景 `#f5f6f5`
- 主色调：深绿 `#257d60`、粉 `#eb4b86`、蓝 `#3449d8`、橙 `#df8733`
- 卡片圆角 8px，box-shadow 轻影
- 三栏布局：左侧 200px 导航 + 中间自适应 + 右侧 292px 面板
- **全中文**：所有面向用户的文案必须中文，不允许英文菜单/按钮/提示

## 硬性约束

- ❌ 不依赖后端 API
- ❌ 不依赖数据库
- ❌ 不需要登录
- ❌ 不上传文件到服务器
- ✅ `npm run build` 产出纯静态文件可直接部署
- ✅ 所有数据处理在浏览器本地完成
- ✅ 页面展示隐私提示："文件仅在当前浏览器本地解析，不会上传服务器"

## Spec 文件位置

详细的需求、设计和任务拆分：

- 原始需求规格：`finance-dashboard-claude-code-spec.md`（根目录）
- HTML 原型参考：`finance-game-dashboard-sample3.html`（根目录）
- 实现任务列表：`.kiro/specs/game-finance-dashboard/tasks.md`

## 实现顺序（任务依赖）

按 wave 并行执行，同一 wave 内的任务可以同时进行：

| Wave | 任务 |
|------|------|
| 0 | 项目初始化 |
| 1 | 核心类型定义 + 表头别名 |
| 2 | Parser + 日期工具 + 币种工具 |
| 3 | Parser 测试 + Normalizer + 日期/币种测试 |
| 4 | Normalizer 测试 + Zustand Store |
| 5 | 筛选测试 + filterRecords/KPI |
| 6 | 筛选/KPI 测试 + 趋势/分类/部门 Selectors |
| 7 | Selector 测试 + Layout |
| 8 | 上传组件 + 筛选面板 + 日历 |
| 9 | KPI 卡片 + 趋势图 + 累计分析 |
| 10 | 分类分布 + 钻取 + 部门 |
| 11 | 明细表 + 热力图 + 抽屉 |
| 12 | 持久化模块 + ECharts 主题 |
| 13 | 持久化测试 + 保存视图组件 |
| 14 | 集成联调 |

## 常见问题

**Q: 为什么不用路由？**
单页应用，导入前是上传界面，导入后是仪表盘，用状态切换即可。

**Q: 为什么不用 UI 组件库？**
保持与 HTML 原型完全一致的视觉风格，自定义 CSS 更灵活。

**Q: 为什么 ECharts 而不是 CSS 自绘？**
原始设计文档建议 CSS 自绘，但 tasks.md 中已决定用 ECharts 以提高开发效率和图表交互能力。保持浅色克制风格通过自定义主题实现。

**Q: 金额单位是什么？**
原始数据是元，展示时统一转为万元（÷10000），格式如 `¥191.8万` 或 `$26.6万`。

**Q: 默认美元汇率是多少？**
7.2，定义在 constants.ts 中。用户导入时若 USD 记录缺汇率则使用此默认值。
