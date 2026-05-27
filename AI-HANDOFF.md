# 游戏公司财务费用分析可视化平台 — AI 接手说明

> 本文档供下一位 AI 或开发者接手时快速了解项目全貌。

## 1. 项目概述

纯前端、全中文、可静态部署的 Excel 财务可视化工具。用户打开网页，把 Excel 费用流水表拖入，即可在浏览器本地完成解析、清洗、筛选、图表分析和明细钻取。

**技术栈：** Vite + React 19 + TypeScript + Zustand + ECharts + xlsx (SheetJS) + date-fns + fast-check  
**部署方式：** `npm run build` → 纯静态文件，无后端依赖  
**开发启动：** `npm run dev` (Vite, http://localhost:5173)  
**测试：** `npm test` (Vitest + fast-check property tests)

## 2. 目录结构

```
src/
├── App.tsx                      # 应用入口，多页路由，仪表盘布局
├── index.css                    # 全局 CSS 变量和基础样式
├── types/
│   ├── expense.ts               # ExpenseRecord, FilterState 等核心类型
│   └── chart.ts                 # 图表数据类型 (KpiResult, TrendPoint 等)
├── data/
│   ├── parser.ts                # Excel 解析 + 表头识别
│   ├── normalizer.ts            # 数据标准化 + 状态判定
│   ├── headerAliases.ts         # 表头别名映射（中英文）
│   └── selectors.ts             # 所有计算/聚合函数
├── state/
│   ├── store.ts                 # Zustand 全局 Store（核心！）
│   ├── filterActions.ts         # 筛选联动辅助函数
│   └── persistence.ts           # localStorage/IndexedDB 持久化
├── utils/
│   ├── dateUtils.ts             # 日期解析、粒度判断、区间生成
│   ├── currencyUtils.ts         # 金额格式化（万元）
│   └── constants.ts             # 默认汇率、颜色、空 FilterState
├── components/
│   ├── Layout.tsx               # 三栏布局 + 顶栏 + 浮动回退/筛选标签
│   ├── Sidebar.tsx              # 左侧导航栏（4 页面切换）
│   ├── FilterPanel.tsx          # 筛选面板（6 下拉 + 保存/重置）
│   ├── FilterTags.tsx           # 浮动筛选标签（左侧 fixed）
│   ├── KpiCards.tsx             # 4 个 KPI 卡片
│   ├── TrendOverview.tsx        # 费用趋势总览（柱+线，粒度联动）
│   ├── CumulativeAnalysis.tsx   # 累计分析（柱+线+摘要）
│   ├── ExpenseScopeCard.tsx     # 费用口径卡（确认/待确认占比条）
│   ├── CategoryDistribution.tsx # 费用结构分布（完整环饼图）
│   ├── CategoryDrill.tsx        # 分类钻取（L1→L2→L3）
│   ├── DepartmentRanking.tsx    # 项目排行（滚动列表）
│   ├── DepartmentDetail.tsx     # 部门费用详情（CSS柱图+Top明细）
│   ├── Heatmap.tsx              # 费用热力图（7列+时间标签）
│   ├── ExpenseTable.tsx         # 明细追溯表
│   ├── CalendarPanel.tsx        # 日历筛选（年/月/日/区间）
│   ├── TimelinePanel.tsx        # 时间线待办面板
│   ├── SavedViews.tsx           # 保存视图
│   ├── UploadDropzone.tsx       # 拖拽上传
│   ├── ImportPreview.tsx        # 导入预览
│   └── pages/
│       ├── DataImportPage.tsx       # 数据导入页
│       ├── ExpenseGovernancePage.tsx # 费用治理页
│       └── DataSearchPage.tsx       # 数据搜索页
└── theme/
    └── echarts.ts               # ECharts 自定义主题
```

## 3. 核心状态（Zustand Store）

文件：`src/state/store.ts`

```typescript
records: ExpenseRecord[]        // 所有费用记录
filter: FilterState             // 全局筛选状态
filterHistory: FilterState[]    // 回退栈（最多 50）
filterFuture: FilterState[]     // 前进栈
currentPage: PageKey            // '总览'|'数据导入'|'费用治理'|'数据搜索'
importPhase: 'idle'|'parsing'|'preview'|'dashboard'
```

**关键 Actions：**
- `importData(records, summary)` — 导入时自动归类（收入/往来/费用）
- `updateFilter(partial)` — 修改筛选 + 推入历史栈
- `undoFilter()` / `redoFilter()` — 回退/前进
- `updateRecordType(ids, type)` — 批量修改交易类型

## 4. 数据流

```
Excel → parser.ts → normalizer.ts → store.importData (自动归类)
                                         ↓
                               Zustand Store (records + filter)
                                         ↓
                              selectors.ts (派生计算)
                                         ↓
                         React 组件 (ECharts / 表格 / 卡片)
```

## 5. 自动归类逻辑

在 `store.ts` 的 `importData` 中，导入时自动处理：
- 三级分类含 "收入/利息/分成/补贴/版权/期权" → `transactionType = 'income'`
- 三级分类含 "借款/押金/保证金" → `transactionType = 'intercompany'`
- 其他 → `transactionType = 'expense'`（自动确认为费用）

## 6. 筛选优先级

时间筛选 3 级优先：
1. `filter.date`（精确日）> 2. `dateStart/dateEnd`（区间）> 3. `period`（年/月）

## 7. 趋势图粒度规则

| 用户选择 | 默认粒度 | 显示粒度按钮 |
|---------|---------|------------|
| 某天 | 日（显示当月日趋势，高亮选中日） | 隐藏 |
| 某月 | 日 | 隐藏 |
| 某年 | 月 | 年/季度/月 |
| 其他/无 | 月 | 年/季度/月/日 |

## 8. 日历交互规则

- 年/月/日/区间按钮只在精确匹配时高亮
- 再次点击已高亮按钮 → 取消选中（回退一级）
- 月份网格：只在 period=YYYY-MM 时高亮
- 日期格：只在 filter.date 匹配时高亮

## 9. Excel 导入注意事项

实际用户的 Excel 有以下特殊情况（已处理）：
- 日期为 Excel serial number（如 45673）
- 日期为中文格式（如 "2025年1月16日"，可能带引号）
- 金额带千分位逗号（如 "10,000.00"）
- 币种列表头为空（通过数据行自动推断）
- 期间为中文（如 "2025年1月" → 标准化为 "2025-01"）
- 表头有多余空格（"交易金额  贷" → 归一化匹配）

## 10. 已知待修复问题

1. **确认费用 KPI 计算** — `getKpis` 中 `confirmedExpense` 要求 `importStatus='normal'`，但自动归类为 expense 的记录 importStatus 可能仍是 `pending_classify`。需要在 importData 中同时设置 importStatus='normal'，或放宽 KPI 计算条件。

2. **日历取消选中闭包问题** — `CalendarPanel.tsx` 的 handleGranYear/Month/Day 的 useCallback 依赖可能不完整，导致 toggle-off 逻辑失效。需检查依赖数组。

3. **累计分析图联动** — `CumulativeAnalysis.tsx` 需要像 TrendOverview 一样，选日时用修改后的 filter 获取完整月数据，并高亮选中日。标题需根据粒度动态变化。

## 11. UI 视觉参考

原型文件：`finance-game-dashboard-sample3.html`（在项目根目录）  
设计文档：`finance-game-dashboard-sample3-ui-rebuild-spec.md`（在项目根目录）

CSS 变量定义在 `index.css`：
- `--green: #257d60` 主色
- `--bg: #f5f6f5` 背景
- `--surface: #ffffff` 卡片背景
- `--shadow: 0 10px 28px rgba(28,40,34,.06)` 卡片阴影

## 12. 运行指令

```bash
npm install          # 安装依赖
npm run dev          # 开发服务器 (Vite)
npm test             # 运行测试 (Vitest)
npm run build        # 构建静态文件 → dist/
```

## 13. 测试

Property-based 测试文件：
- `src/data/parser.property.test.ts` — 表头识别
- `src/data/normalizer.property.test.ts` — 日期/币种/金额/状态
- `src/utils/dateUtils.property.test.ts` — 趋势粒度/累计粒度
- `src/utils/currencyUtils.property.test.ts` — 金额格式化
- `src/state/filter.property.test.ts` — 筛选优先级/币种过滤
- `src/data/selectors.property.test.ts` — KPI/分类/部门
- `src/state/persistence.property.test.ts` — 持久化往返
