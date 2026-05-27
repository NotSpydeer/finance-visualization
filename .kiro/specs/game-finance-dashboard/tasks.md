# Implementation Plan: Game Finance Dashboard

## Overview

基于 Vite + React + TypeScript + Zustand + ECharts + xlsx (SheetJS) 构建游戏公司财务费用分析可视化平台。实现步骤按照：项目初始化 → 数据层（解析/标准化）→ 状态层（Store/筛选）→ 计算层（Selectors）→ 组件层（UI/图表）→ 持久化 → 集成联调的顺序递进。

## Tasks

- [x] 1. 项目初始化与核心类型定义
  - [x] 1.1 初始化 Vite + React + TypeScript 项目结构
    - 运行 `npm create vite@latest` 创建项目
    - 安装核心依赖：`zustand`, `echarts`, `echarts-for-react`, `xlsx`, `date-fns`, `idb-keyval`
    - 安装开发依赖：`vitest`, `fast-check`, `@testing-library/react`, `jsdom`
    - 创建 `src/` 下的目录结构：`types/`, `data/`, `state/`, `utils/`, `components/`, `theme/`
    - 配置 `vitest.config.ts` 和 `tsconfig.json`
    - _Requirements: 20.1, 20.2, 20.3_

  - [x] 1.2 定义核心类型与接口
    - 创建 `src/types/expense.ts`：定义 `ExpenseRecord`, `FilterState`, `ImportStatus`, `TransactionType`, `CurrencyMode`, `TrendGrain`, `ImportSummary`, `ImportConfig`, `SavedView`
    - 创建 `src/types/chart.ts`：定义 `KpiResult`, `TrendPoint`, `CumulativePoint`, `CategoryDistributionItem`, `DepartmentAmount`, `DepartmentDetail`, `HeatmapCell`, `DrawerContext`
    - 创建 `src/utils/constants.ts`：定义默认汇率、颜色等级等常量
    - _Requirements: 3.1-3.11, 4.1-4.5, 5.1_

  - [x] 1.3 创建表头别名映射表
    - 创建 `src/data/headerAliases.ts`：定义 `HEADER_ALIASES` 映射（date, amount, amountCNY, currency, exchangeRate, categoryL1/L2/L3, categoryExtra, department, person, bankAccount, periodMonth, transactionType）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2. Excel 解析与数据标准化模块
  - [x] 2.1 实现 Parser 模块
    - 创建 `src/data/parser.ts`
    - 实现 `parseExcel(file: File): Promise<ParseResult>` 函数：使用 xlsx 库读取 ArrayBuffer，提取第一个 sheet 的 JSON 数据
    - 实现 `recognizeHeaders(headerRow: string[]): FieldMapping` 函数：遍历 HEADER_ALIASES 进行匹配
    - 实现文件格式校验（仅允许 .xlsx/.xls）
    - 实现错误处理：缺少日期字段、缺少金额字段、无有效表头的中文提示
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1-2.7_

  - [x] 2.2 编写 Parser 表头识别属性测试
    - **Property 1: Header Alias Recognition**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [x] 2.3 实现 Normalizer 模块
    - 创建 `src/data/normalizer.ts`
    - 实现 `normalizeRecords(rows, mapping, config): NormalizeResult` 函数
    - 实现日期标准化：处理 Excel serial date、YYYY/MM/DD、YYYY-MM-DD 格式
    - 实现币种标准化：RMB/CNY/人民币 → RMB，USD/美元 → USD
    - 实现金额计算：缺失 amountCNY 时按 amount × exchangeRate 计算
    - 实现默认值填充：department 缺失→「未分配部门」，categoryL1 缺失→「未分类」
    - 实现唯一 ID 生成：`importBatchId-sourceRowNo`
    - 实现 `determineImportStatus(record)` 函数：normal / pending_classify / abnormal 判定逻辑
    - _Requirements: 3.1-3.11, 4.1-4.6_

  - [x] 2.4 编写日期标准化属性测试
    - **Property 2: Date Normalization Round-Trip**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 2.5 编写币种标准化属性测试
    - **Property 3: Currency Alias Normalization**
    - **Validates: Requirements 3.3, 3.4**

  - [x] 2.6 编写 AmountCNY 计算属性测试
    - **Property 4: AmountCNY Computation**
    - **Validates: Requirements 3.7**

  - [x] 2.7 编写导入状态判定属性测试
    - **Property 5: Import Status Determination**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [x] 3. Checkpoint - 数据层验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. 日期与币种工具函数
  - [x] 4.1 实现日期工具函数
    - 创建 `src/utils/dateUtils.ts`
    - 实现 `parseDateValue(value: unknown): string | null`：处理 Excel serial date 转换
    - 实现 `getDefaultTrendGrain(state: FilterState): TrendGrain`：根据筛选状态自动选择粒度
    - 实现 `getCumulativeGrain(state: FilterState): 'day' | 'week' | 'month'`：根据区间长度选择粒度
    - 实现 `getDateWindow(state, records): { start, end }`：计算当前时间窗口
    - 实现 `monthRange`, `dateRange`, `quarterRange` 辅助函数
    - _Requirements: 9.1-9.5, 10.1-10.6_

  - [x] 4.2 编写趋势粒度自动选择属性测试
    - **Property 11: Trend Grain Auto-Selection**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

  - [x] 4.3 编写累计粒度选择属性测试
    - **Property 12: Cumulative Grain Selection**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7**

  - [x] 4.4 实现币种工具函数
    - 创建 `src/utils/currencyUtils.ts`
    - 实现 `displayMoney(amountCNY, currencyMode, usdRate): string`：格式化为「X.X万」或「$X.X万」
    - 实现 `convertToDisplayCurrency(amountCNY, mode, rate): number`
    - _Requirements: 7.1, 7.2_

  - [x] 4.5 编写币种显示格式属性测试
    - **Property 8: Currency Display Formatting**
    - **Validates: Requirements 7.1, 7.2**

- [x] 5. 状态管理与筛选引擎
  - [x] 5.1 实现 Zustand Store
    - 创建 `src/state/store.ts`
    - 定义 `AppState` 接口和默认初始状态
    - 实现 `importData`, `updateFilter`, `resetFilter`, `clearTimeFilter`, `openDrawer`, `closeDrawer` actions
    - 创建 `src/state/filterActions.ts`：封装筛选联动逻辑（时间优先级、trendManual 重置）
    - _Requirements: 5.1-5.6, 6.1-6.5_

  - [x] 5.2 编写筛选时间优先级属性测试
    - **Property 6: Filter Time Priority**
    - **Validates: Requirements 5.3, 5.4, 5.5**

  - [x] 5.3 编写筛选重置属性测试
    - **Property 7: Filter Reset Invariants**
    - **Validates: Requirements 6.4, 6.5**

- [x] 6. Selector 计算层
  - [x] 6.1 实现 filterRecords 与 KPI Selectors
    - 创建 `src/data/selectors.ts`
    - 实现 `filterRecords(records, state): ExpenseRecord[]`：按时间优先级 + 维度筛选 + 币种/状态筛选
    - 实现 `getKpis(records, state): KpiResult`：计算确认费用、原始金额、待确认、峰值
    - _Requirements: 5.3-5.5, 7.3, 7.4, 8.1-8.4_

  - [x] 6.2 编写币种过滤正确性属性测试
    - **Property 9: Currency Filter Correctness**
    - **Validates: Requirements 7.3, 7.4**

  - [x] 6.3 编写 KPI 计算不变量属性测试
    - **Property 10: KPI Calculation Invariants**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

  - [x] 6.4 实现趋势、累计、分类、部门 Selectors
    - 实现 `getTrendData(records, state): TrendPoint[]`：按 trendGrain 聚合
    - 实现 `getCumulativeData(records, state): CumulativePoint[]`：计算累计值
    - 实现 `getCategoryDistribution(records, state): CategoryDistributionItem[]`：基于除 category 外的筛选条件聚合
    - 实现 `getDepartmentRanking(records, state): DepartmentAmount[]`：基于除 department 外的筛选条件降序排列
    - 实现 `getDepartmentDetail(records, state): DepartmentDetail`：包含近 6 期趋势和 Top 4 明细
    - 实现 `getTableRows(records, state): ExpenseRecord[]`
    - 实现 `getHeatmapData(records, state): HeatmapCell[][]`
    - _Requirements: 9.1-9.10, 10.1-10.7, 11.1-11.3, 13.1, 14.1-14.4, 15.1, 21.1-21.2_

  - [x] 6.5 编写分类分布不变量属性测试
    - **Property 13: Category Distribution Invariants**
    - **Validates: Requirements 11.1, 11.3**

  - [x] 6.6 编写部门排行排序属性测试
    - **Property 14: Department Ranking Sort Order**
    - **Validates: Requirements 13.1**

- [x] 7. Checkpoint - 状态层与计算层验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. 布局与上传组件
  - [x] 8.1 实现整体布局组件
    - 创建 `src/components/Layout.tsx`：左侧导航 + 中间内容区 + 右侧日历面板的三栏布局
    - 创建 `src/App.tsx`：应用入口，根据 importPhase 切换上传/预览/仪表盘视图
    - 实现全中文导航：首页、总览等中文标签
    - _Requirements: 19.1, 19.2, 20.1_

  - [x] 8.2 实现上传组件与导入预览
    - 创建 `src/components/UploadDropzone.tsx`：拖拽/点击上传区域，包含隐私提示「文件仅在当前浏览器本地解析，不会上传服务器」
    - 创建 `src/components/ImportPreview.tsx`：展示总行数、正常行数、待归类行数、异常行数、字段映射结果
    - 实现确认导入按钮，点击后调用 store.importData 进入仪表盘
    - 实现全部异常时阻止进入仪表盘并显示提示
    - _Requirements: 1.1-1.6, 22.1-22.3, 19.4, 20.5_

- [x] 9. 筛选与日历组件
  - [x] 9.1 实现筛选面板与标签组件
    - 创建 `src/components/FilterPanel.tsx`：维度筛选（person, department, categoryL1/L2/L3, bankAccount, currency, importStatus）+ 币种口径切换 + 趋势粒度切换
    - 创建 `src/components/FilterTags.tsx`：展示当前激活筛选条件标签，每个标签支持点击清除
    - _Requirements: 5.6, 6.3, 7.5_

  - [x] 9.2 实现日历筛选组件
    - 创建 `src/components/CalendarPanel.tsx`
    - 实现年/月/日点击和日期区间选择
    - 实现时间口径状态显示：按年、按月、按日、按日期区间、全部时间
    - 实现异常日期边框提示
    - 实现与 FilterEngine 的双向同步
    - _Requirements: 16.1-16.6, 6.1, 6.2_

- [x] 10. KPI 与趋势图组件
  - [x] 10.1 实现 KPI 总览卡片组件
    - 创建 `src/components/KpiCards.tsx`
    - 展示四个卡片：确认费用支出、原始交易金额、待确认金额、峰值金额
    - 实现卡片点击交互：待确认→设置筛选，峰值→跳转月份+Drawer，其他→打开 Drawer
    - _Requirements: 8.1-8.7_

  - [x] 10.2 实现费用趋势总览组件
    - 创建 `src/components/TrendOverview.tsx`
    - 使用 ECharts bar chart 展示趋势数据
    - 实现粒度切换（年/季度/月/日）按钮
    - 实现点击趋势柱写入筛选条件（年→period, 月→period, 日→date, 季度→dateRange）
    - 实现日粒度时高亮选中日（橙色）
    - _Requirements: 9.1-9.10_

  - [x] 10.3 实现累计分析组件
    - 创建 `src/components/CumulativeAnalysis.tsx`
    - 使用 ECharts 展示柱状图 + 累计折线
    - 展示三个摘要：峰值粒度及金额、累计金额、波动率
    - _Requirements: 10.1-10.7_

- [x] 11. 分类与部门组件
  - [x] 11.1 实现费用结构分布组件
    - 创建 `src/components/CategoryDistribution.tsx`
    - 使用 ECharts 半环图展示各一级分类占比
    - 展示分类列表：名称、金额、占比
    - 实现点击分类→设置 categoryL1 + 打开 Drawer
    - 实现高亮选中分类、无数据灰色提示
    - _Requirements: 11.1-11.6_

  - [x] 11.2 实现分类钻取组件
    - 创建 `src/components/CategoryDrill.tsx`
    - 实现 L1 → L2 → L3 三层钻取逻辑
    - 实现返回上级按钮
    - 实现点击三级分类打开 Drawer
    - _Requirements: 12.1-12.5_

  - [x] 11.3 实现部门排行与详情组件
    - 创建 `src/components/DepartmentRanking.tsx`：部门列表降序排列，支持点击选中和高亮
    - 创建 `src/components/DepartmentDetail.tsx`：展示部门金额总计、命中条数、近 6 期趋势、Top 4 明细
    - 实现未选择时默认展示最高金额部门
    - _Requirements: 13.1-13.4, 14.1-14.4_

- [x] 12. 明细表、热力图与抽屉组件
  - [x] 12.1 实现明细表组件
    - 创建 `src/components/ExpenseTable.tsx`
    - 展示 date, person, department, categoryL1, categoryL3, bankAccount, amount, transactionType, sourceRowNo 列
    - 默认展示前 10 条，支持点击行打开 Drawer
    - _Requirements: 15.1-15.3_

  - [x] 12.2 实现费用热力图组件
    - 创建 `src/components/Heatmap.tsx`
    - 使用 ECharts heatmap 展示分类/部门 × 时间的金额分布
    - 实现 4 级颜色等级
    - 实现点击单元格→写入筛选或打开 Drawer
    - _Requirements: 21.1-21.3_

  - [x] 12.3 实现右侧抽屉组件
    - 创建 `src/components/DetailDrawer.tsx`
    - 展示当前口径金额、命中笔数、最大单笔
    - 展示 Top 分类构成、Top 部门构成
    - 展示金额最高的 6 条明细
    - 响应不同来源（KPI/趋势/分类/部门/明细/热力图）的上下文
    - _Requirements: 17.1-17.4_

- [x] 13. Checkpoint - 组件层验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. 持久化与保存视图
  - [x] 14.1 实现本地持久化模块
    - 创建 `src/state/persistence.ts`
    - 实现 IndexedDB 数据缓存（使用 idb-keyval）：`cacheData(records)` 和 `loadCachedData()`
    - 实现 localStorage 视图存取：`saveView(view)` 和 `loadViews()`
    - 实现页面加载时缓存检测和恢复提示逻辑
    - 实现存储满降级策略（try-catch + 中文提示）
    - _Requirements: 23.1-23.4, 18.1-18.4_

  - [x] 14.2 编写保存视图持久化属性测试
    - **Property 15: Saved View Persistence Round-Trip**
    - **Validates: Requirements 18.1, 18.2, 18.3**

  - [x] 14.3 编写数据缓存往返属性测试
    - **Property 16: Data Cache Round-Trip**
    - **Validates: Requirements 23.1, 23.4**

  - [x] 14.4 实现保存视图组件
    - 创建 `src/components/SavedViews.tsx`
    - 展示已保存视图列表（最多 6 个）
    - 实现保存当前视图按钮（自动生成名称如「period:2026-03 / categoryL1:未分类」）
    - 实现点击视图恢复筛选状态
    - _Requirements: 18.1-18.4_

- [x] 15. ECharts 主题与集成联调
  - [x] 15.1 创建 ECharts 自定义主题
    - 创建 `src/theme/echarts.ts`
    - 定义统一配色方案、tooltip 中文格式（「2026-03｜费用 191.8万」）
    - 配置图表默认选项（grid, legend, animation）
    - _Requirements: 19.3_

  - [x] 15.2 集成联调与全页刷新验证
    - 确保筛选变更触发所有组件重算（FilterPanel ↔ CalendarPanel ↔ 图表点击三向同步）
    - 确保导入 → 预览 → 仪表盘完整流程通畅
    - 确保新导入清空旧数据
    - 确保页面刷新后缓存恢复流程正常
    - _Requirements: 1.5, 5.2, 6.1-6.5, 23.2-23.4_

- [x] 16. Final checkpoint - 全部验证
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All UI text, labels, tooltips, and error messages must be in Chinese (中文)
- The project produces pure static files deployable to any static hosting service
- No backend API calls or server-side processing is needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "4.1", "4.4"] },
    { "id": 3, "tasks": ["2.2", "2.3", "4.2", "4.3", "4.5"] },
    { "id": 4, "tasks": ["2.4", "2.5", "2.6", "2.7", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 7, "tasks": ["6.5", "6.6", "8.1"] },
    { "id": 8, "tasks": ["8.2", "9.1", "9.2"] },
    { "id": 9, "tasks": ["10.1", "10.2", "10.3"] },
    { "id": 10, "tasks": ["11.1", "11.2", "11.3"] },
    { "id": 11, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 12, "tasks": ["14.1", "15.1"] },
    { "id": 13, "tasks": ["14.2", "14.3", "14.4"] },
    { "id": 14, "tasks": ["15.2"] }
  ]
}
```
