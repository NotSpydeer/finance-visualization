# 游戏公司财务费用分析平台 UI 复刻与实现说明

> 来源原型：`finance-game-dashboard-sample3.html`  
> 目标读者：下一位负责落地的 AI 或前端工程师  
> 项目定位：纯前端、全中文、本地导入 Excel 后即时生成财务费用可视化报表  

## 1. 总目标

把 `finance-game-dashboard-sample3.html` 复刻为一个可正式运行的前端项目。用户打开网页后，只需要导入费用 Excel 表格，就能在浏览器本地完成解析、清洗、筛选、图表聚合、钻取分析和明细追溯。

必须保持当前原型的 UI 气质：浅色背景、左侧导航、中间表格化卡片、右侧日历和时间线、克制的游戏公司财务分析风格。页面要精美，但颜色不要过艳，不要做深色赛博风，不要做营销落地页。

硬性要求：

- 纯前端项目，不依赖后端、数据库、登录系统或云端文件存储。
- 支持 `.xlsx` / `.xls` 本地导入，所有计算在浏览器完成。
- 所有用户可见文案必须是中文。
- 保留当前页面的信息密度、卡片比例、颜色体系和点击反馈。
- 用户点击日历、图表、分类、部门、KPI、明细行时，本质都是在增加或修改筛选条件，所有图表必须联动刷新。
- 不要出现网页端指挥提示弹窗或教学弹窗。

## 2. 技术建议

推荐实现方式：

```text
Vite + React + TypeScript
Excel 解析：xlsx
图表实现：优先 CSS/HTML/SVG 自绘，或 ECharts 但必须复刻当前视觉
状态管理：useReducer、Zustand 或等价单一筛选状态
本地保存：localStorage 保存筛选视图和最近导入配置
```

建议目录：

```text
src/
  App.tsx
  types/expense.ts
  data/importExpense.ts
  data/normalizeExpense.ts
  data/selectors.ts
  state/filterStore.ts
  components/
    Layout.tsx
    Sidebar.tsx
    FilterPanel.tsx
    KpiCards.tsx
    TrendOverview.tsx
    ExpenseScopeCard.tsx
    CumulativeAnalysis.tsx
    CategoryDistribution.tsx
    DepartmentRanking.tsx
    ExpenseHeatmap.tsx
    CategoryDrill.tsx
    DepartmentDetail.tsx
    ExpenseTable.tsx
    CalendarPanel.tsx
    TimelinePanel.tsx
    DetailDrawer.tsx
    UploadDropzone.tsx
    SavedViews.tsx
```

## 3. 视觉规范

### 3.1 基础色板

必须使用接近以下色板：

```css
:root {
  --bg: #f5f6f5;
  --surface: #ffffff;
  --sidebar: #f2f4f2;
  --line: #e6e9e6;
  --text: #171a17;
  --muted: #737b73;
  --green: #257d60;
  --green-2: #94c6b4;
  --green-3: #d9eee6;
  --pink: #eb4b86;
  --pink-2: #fde3ed;
  --blue: #3449d8;
  --blue-2: #e5e9ff;
  --orange: #df8733;
  --orange-2: #fdebdc;
  --lime: #98bd29;
  --yellow: #f5bc38;
  --shadow: 0 10px 28px rgba(28, 40, 34, .06);
  --radius: 8px;
}
```

视觉原则：

- 背景是浅灰绿 `#f5f6f5`，卡片白底，边线极浅。
- 主强调色是绿色 `#257d60`，粉色、蓝色、橙色、黄绿色只做分类辅助。
- 卡片圆角控制在 8px 左右，不做大圆角糖果风。
- 阴影要轻，像数据产品，不像游戏活动页。
- 字体使用 `"Inter", "Segoe UI", "Microsoft YaHei", Arial, sans-serif`。
- 字间距为 `0`，不要使用负字距。

### 3.2 页面布局

整体为三栏布局：

```css
body {
  margin: 0;
  min-width: 1360px;
  background: var(--bg);
}

.app {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 292px;
  min-height: 100vh;
}
```

三栏说明：

| 区域 | 宽度 | 内容 |
|---|---:|---|
| 左侧导航栏 | 200px | 产品名、导航、工具入口、浅色模式 |
| 中间主内容 | 自适应 | 筛选、KPI、趋势、结构、排行、钻取、明细表 |
| 右侧面板 | 292px | 日历筛选、当前筛选说明、时间线任务 |

当屏幕变窄时可以适度压缩为 `186px / 1fr / 260px`，KPI 从 4 列变 2 列，但首版可以要求桌面端优先。

## 4. 页面结构

### 4.1 左侧导航栏

左侧是浅灰绿背景，顶部显示：

- 圆形头像：`GF`
- 产品名：`游戏财务分析`
- 副标题：`本地表格可视化`

导航按钮：

1. `总览`
2. `导入记录`
3. `月度结账`
4. `费用分析`
5. `主体对比`
6. `分类规则`

底部工具：

- `浅色模式`
- `帮助中心`
- `退出`

导航交互：

- 当前按钮背景为 `var(--green-3)`，文字为 `var(--green)`。
- Hover 同样使用浅绿色反馈。
- 不需要真正路由，首版可以只高亮点击项。

### 4.2 顶部栏

中间顶部高度约 54px，白底，下边线。

Tab：

- `总览`
- `报表`
- `费用实验室`
- `数据质量`

右侧两个圆形按钮，可作为通知和设置。点击只做短暂高亮即可。

### 4.3 主内容头部

标题区：

- 左侧小标题：`总览`
- 右侧按钮：
  - `2025-01 - 2026-04`
  - `全部主体`
  - `导出`

下面是全局筛选表，必须和日历联动。

## 5. 全局筛选表

筛选表是白色卡片，8px 圆角，轻阴影。布局为 6 个下拉 + 2 个按钮：

| 控件 | ID 建议 | 说明 |
|---|---|---|
| 时间 | `filterPeriod` | 全部期间、2025 全年、2025-12、2026-03、动态追加的年月 |
| 主体 | `filterPerson` | 全部主体、各公司实体 |
| 部门/项目 | `filterDepartment` | 全部部门、未分配部门、财务部、行政部、项目名等 |
| 一级分类 | `filterCategory` | 全部分类、管理费用、研发费用、人员成本、财务费用、销售费用、未分类 |
| 银行账户 | `filterBank` | 全部银行、招商银行人民币户、民生银行人民币户、民生银行美元户等 |
| 币种 | `filterCurrency` | 全人民币口径、全美金口径、仅 RMB 交易、仅 USD 交易 |
| 保存视图 | `saveViewBtn` | 保存当前筛选状态到 localStorage |
| 重置 | `resetFilterBtn` | 清空所有筛选，金额口径恢复人民币 |

注意：不要出现“全部交易币种”这个选项。币种下拉只保留：

- `全人民币口径`：所有交易都换算成人民币展示，不筛选交易币种。
- `全美金口径`：所有交易都换算成美元展示，不筛选交易币种。
- `仅 RMB 交易`：只看原币为 RMB 的记录。
- `仅 USD 交易`：只看原币为 USD 的记录。

筛选表下方显示筛选路径 chip，例如：

```text
金额: 全人民币口径 ×
时间: 2026-03 ×
主体: 北京格瑞拉科技有限公司 ×
一级: 管理费用 ×
```

日期区间 chip 示例：

```text
日期区间: 2026-01-01 至 2026-05-31 ×
```

## 6. 数据模型

导入后统一转为 `ExpenseRecord`。字段必须完整支持以下 17 个：

| 字段 | 类型 | 必需 | 说明 |
|---|---|---:|---|
| `date` | string | 是 | 交易日期，格式 `YYYY-MM-DD` |
| `amount` | number | 是 | 原币金额 |
| `amountCNY` | number | 是 | 本位币金额，人民币口径 |
| `currency` | `RMB`/`USD` | 是 | 原交易币种 |
| `exchangeRate` | number | 是 | 汇率，RMB 为 1，USD 可默认 7.2 |
| `categoryL1` | string | 否 | 一级分类 |
| `categoryL2` | string | 否 | 二级分类 |
| `categoryL3` | string | 否 | 三级分类 |
| `categoryExtra` | string | 否 | 辅助分类 |
| `department` | string | 否 | 部门/项目 |
| `person` | string | 否 | 主体，公司实体 |
| `bankAccount` | string | 否 | 银行账户 |
| `periodMonth` | string | 是 | 期间，格式 `YYYY-MM` |
| `transactionType` | enum | 是 | `expense`、`income`、`intercompany`、`unclassified` |
| `importStatus` | enum | 是 | `normal`、`pending_classify`、`abnormal` |
| `sourceRowNo` | number | 是 | Excel 原始行号 |
| `id` | string | 建议 | 前端内部唯一 ID，可由批次号和行号生成 |

内部金额规则：

- 所有聚合先用 `amountCNY` 计算。
- 展示人民币口径时：`amountCNY` 显示为 `xx.x万`。
- 展示美金口径时：`amountCNY / 7.2` 显示为 `$xx.x万`。
- `仅 RMB 交易` 和 `仅 USD 交易` 是交易币种筛选，不改变换算公式。

## 7. Excel 导入规则

### 7.1 字段识别别名

| 标准字段 | 可识别表头 |
|---|---|
| `date` | 日期、交易日期、记账日期、date |
| `amount` | 原币金额、金额、借方金额、贷方金额、amount |
| `amountCNY` | 本位币金额、人民币金额、折人民币、amountCNY |
| `currency` | 币种、货币、currency |
| `exchangeRate` | 汇率、exchangeRate |
| `categoryL1` | 一级分类、费用大类、categoryL1 |
| `categoryL2` | 二级分类、费用分类、categoryL2 |
| `categoryL3` | 三级分类、明细分类、categoryL3 |
| `categoryExtra` | 辅助分类、标签、categoryExtra |
| `department` | 部门、项目、部门/项目、department |
| `person` | 主体、公司、公司主体、person |
| `bankAccount` | 银行账户、账户、bankAccount |
| `periodMonth` | 期间、月份、periodMonth |
| `transactionType` | 交易类型、收支类型、transactionType |
| `importStatus` | 导入状态、状态、importStatus |
| `sourceRowNo` | 原始行号、sourceRowNo |

### 7.2 标准化

- 日期支持 Excel serial date、`YYYY/MM/DD`、`YYYY-MM-DD`，统一为 `YYYY-MM-DD`。
- `periodMonth` 缺失时由 `date.slice(0, 7)` 生成。
- `RMB`、`CNY`、`人民币` 统一为 `RMB`。
- `USD`、`美元` 统一为 `USD`。
- `exchangeRate` 缺失时，RMB 为 1，USD 使用默认 7.2。
- `amountCNY` 缺失时按 `amount * exchangeRate` 计算。
- `department` 缺失填 `未分配部门`。
- 分类缺失时 `categoryL1 = 未分类`，`importStatus = pending_classify`。
- `transactionType` 缺失填 `unclassified`。

### 7.3 导入状态

| 状态 | 判定 |
|---|---|
| `normal` | 日期、金额、币种、期间有效，且分类完整 |
| `pending_classify` | 分类缺失、交易类型未识别、部门未分配但金额有效 |
| `abnormal` | 日期无效、金额非数字、币种不支持、USD 汇率缺失、金额换算差异异常 |

## 8. 全局状态

所有筛选和图表点击共用同一个状态。

```ts
type FilterState = {
  period: string;        // '', '2025', '2026-03'
  date: string;          // '', '2026-03-12'
  dateStart: string;     // 日期区间开始
  dateEnd: string;       // 日期区间结束
  person: string;
  department: string;
  categoryL1: string;
  categoryL2: string;
  categoryL3: string;
  bankAccount: string;
  currency: '' | 'RMB' | 'USD';
  importStatus: '' | 'normal' | 'pending_classify' | 'abnormal';
  currencyMode: 'CNY' | 'USD';
  trendGrain: '' | 'year' | 'quarter' | 'month' | 'day';
  trendManual: boolean;
};
```

时间筛选优先级：

1. `date` 单日筛选优先级最高。
2. 如果没有 `date`，则 `dateStart/dateEnd` 日期区间生效。
3. 如果没有日期区间，则 `period` 生效。
4. `period = YYYY` 表示全年。
5. `period = YYYY-MM` 表示月份。

当设置日期区间时，必须清空 `date` 和 `period`。当设置单日或期间时，必须清空日期区间。

## 9. KPI 卡片

KPI 区域为 4 列卡片，高度约 108px。

| 卡片 | 计算口径 | 点击行为 |
|---|---|---|
| 确认费用支出 | `importStatus=normal` 且 `transactionType=expense` 的金额合计 | 打开抽屉，说明确认费用口径 |
| 原始交易金额 | 当前筛选下所有记录金额合计 | 打开抽屉，说明原始流水口径 |
| 待确认金额 | `importStatus != normal` 或 `categoryL1=未分类` 的金额合计 | 增加筛选 `importStatus=pending_classify`、`categoryL1=未分类`，打开待归类抽屉 |
| 月度峰值 | 当前时间条件下的峰值金额 | 默认点到峰值月份，例如 `2025-12`，打开异常点拆解 |

视觉：

- 图标是 22px 小方块，蓝、粉、绿、橙四色。
- 数字字号约 25px。
- 小标签使用浅绿色或浅粉色底。
- 点击任何卡片都有短暂高亮 `active-glow`。

## 10. 费用趋势总览

这是中间第一块主图，左侧大卡片。

视觉结构：

- 标题：`费用趋势总览`
- 右上角粒度切换：`年 / 季度 / 月 / 日`
- 图表主体为纵向细柱 + 折线叠加。
- 背景有浅网格线。
- 最高点和次高点显示悬浮提示卡。
- X 轴标签根据粒度显示，例如 `25/1`、`25Q4`、`12日`。

默认粒度规则：

| 用户当前时间筛选 | 默认趋势展示 |
|---|---|
| 选择年份 | 展示该年度每月趋势 |
| 选择月份 | 展示该月份每日趋势 |
| 选择单日 | 展示该日所在月份每日趋势，并把选中日用特殊颜色标出 |
| 选择日期区间小于等于 62 天 | 按日展示 |
| 选择日期区间小于等于 370 天 | 按月展示 |
| 日期区间更长 | 按季度展示 |
| 无时间筛选 | 按月展示 |

用户手动点击 `年 / 季度 / 月 / 日` 后，`trendManual = true`，按用户指定粒度展示，直到时间筛选再次变化。

趋势柱点击行为：

| 柱子类型 | 点击后筛选 |
|---|---|
| 年柱 | `period = YYYY` |
| 季度柱 | `dateStart = 季度开始日`，`dateEnd = 季度结束日` |
| 月柱 | `period = YYYY-MM` |
| 日柱 | `date = YYYY-MM-DD`，同时日历进入按日状态 |

点击后必须打开右侧抽屉，标题可为 `年度费用趋势`、`季度费用趋势`、`月度费用趋势`、`日度费用趋势`。

## 11. 费用口径卡

位于趋势图右侧上方。

展示两端对比：

- 左侧：`确认费用`，显示占比和金额。
- 右侧：`待确认`，显示占比和金额。
- 中间横向分割条，绿色表示确认费用，橙色表示待确认。

此卡片用于让老板快速理解“哪些是真费用，哪些需要治理”。

## 12. 月度累计分析

位于趋势图右侧下方。必须和当前时间筛选联动，不是固定 16 个月。

展示规则：

| 当前时间筛选 | 累计分析粒度 |
|---|---|
| 选择年份 | 按该年 12 个月展示 |
| 选择月份 | 按该月每日展示 |
| 选择单日 | 按该日所在月份每日展示 |
| 日期区间小于等于 62 天 | 按日展示 |
| 日期区间小于等于 190 天 | 按周展示 |
| 日期区间更长 | 按月展示 |
| 无时间筛选 | 按所有期间的月度展示 |

卡片顶部三项摘要：

1. 峰值周期和金额，例如 `峰值日 12日 104.3万`。
2. 当前时间段累计金额。
3. 波动率：`(最大值 - 最小值) / 最大值 * 100%`。

柱子状态：

- 最大值使用深绿色 `hot`。
- 大于最大值 75% 使用黄色 `warn`。
- 普通柱使用浅绿色渐变。

## 13. 费用结构分布

位于下方第一张大卡片，必须展示完整一级分类，不可只展示前几项。

视觉：

- 半圆环图，使用 `conic-gradient(from 270deg at 50% 100%)`。
- 环形中间显示最大费用分类、占比、金额。
- 下方是两列图例，每项包含：
  - 彩色圆点
  - 分类名称
  - 金额
  - 占比进度条

一级分类至少支持：

- 管理费用
- 研发费用
- 人员成本
- 财务费用
- 销售费用
- 未分类

联动规则：

- 数据来自当前筛选，但计算分类分布时要忽略当前一级/二级/三级分类筛选，避免点了分类后图例只剩一项。
- 点击图例项后设置 `categoryL1`，清空 `categoryL2/categoryL3`，分类钻取路径进入一级分类。
- 点击后打开抽屉，标题 `一级分类钻取`。

## 14. 项目排行

视觉上沿用当前原型里的 `country-list` 样式，实际含义是部门/项目排行。

计算：

- 当前筛选下，忽略 `department` 条件后按 `department` 聚合。
- 按金额降序排列。

展示：

- 左侧部门/项目名。
- 右侧金额标签，第一名可使用橙粉色或 `down` 样式强调。

点击部门：

- 设置 `state.department`。
- 全页图表、明细表、部门详情同步刷新。
- 打开抽屉，标题 `部门费用详情`，副标题为 `部门名 + 当前筛选条件`。

## 15. 费用热力

热力图是右下小卡片。

视觉：

- 8 列布局：左侧时间标签 + 7 天。
- 时间行：`6pm / 4pm / 2pm / 12pm / 10am / 8am`。
- 列：`S / M / T / W / T / F / S`。
- 色阶：`#dcece6`、`#a8d6c5`、`#5faf91`、`#20785c`。

实际实现时可把交易日期映射到星期，把交易金额映射到色阶。没有时使用 0 值浅色。

## 16. 分类钻取

分类钻取卡片位于下方 `drill-grid` 左侧。

路径：

```text
一级分类 -> 二级分类 -> 三级分类
```

展示规则：

- 无路径时显示所有一级分类。
- 点一级分类后显示该一级下的二级分类。
- 点二级分类后显示三级分类。
- 点三级分类后设置 `categoryL3` 并打开抽屉。

每个按钮：

- 左侧显示分类名。
- 下方小字：
  - 有子级：`点击展开下一级`
  - 三级：`点击锁定三级分类`
- 右侧显示金额。

返回上级按钮：

- 如果在三级，返回二级。
- 如果在二级，返回一级。
- 如果在一级，清空分类路径和 `categoryL1/categoryL2/categoryL3`。

聚合规则：

- 一级列表聚合时忽略所有分类条件。
- 二级列表聚合时固定当前 `categoryL1`，忽略 `categoryL2/categoryL3`。
- 三级列表聚合时固定 `categoryL1/categoryL2`，忽略 `categoryL3`。
- 其他筛选如日期、主体、部门、银行、交易币种必须继续生效。

## 17. 部门费用详情

部门费用详情卡片位于 `drill-grid` 右侧。

内容：

- 摘要三项：
  - 当前部门或自动选中的 Top 部门金额
  - 命中明细笔数
  - 当前金额口径，如 `全人民币口径`
- 小型趋势柱：默认展示最近 6 个期间的部门金额。
- Top 明细按钮：展示当前部门下金额最高的 4 条记录。

联动要求：

- 如果没有选部门，自动展示当前筛选下金额最高的部门。
- 如果选了分类，例如管理费用，则部门详情必须展示“当前部门 + 管理费用”的费用详情。
- 所有内容必须受日历和筛选表限制。
- 点击 Top 明细打开抽屉，追溯到 `sourceRowNo`。

## 18. ExpenseRecord 明细追溯表

底部表格必须保留表格化视觉，边线清楚，底线对齐，尽量不留大空白。

列：

| 列 | 显示 |
|---|---|
| 日期 | `date` |
| 主体 | `person` |
| 部门/项目 | `department` |
| 分类 | `categoryL1 / categoryL3` |
| 银行账户 | `bankAccount` |
| 金额 | 按当前金额口径显示 |
| 交易类型 | `transactionType` 状态标签 |
| 原始行号 | `#sourceRowNo` |

行为：

- 默认展示当前筛选命中的前 10 条。
- 没有数据时显示：`当前筛选没有匹配明细，点击“重置”恢复全部数据。`
- 点击某一行打开抽屉，标题 `原始流水追溯`，副标题 `sourceRowNo #xxx`。

## 19. 右侧日历

右侧日历是本页面最重要的筛选入口之一。

日历上方必须有当前筛选说明：

```text
当前：按月筛选
2026-05，KPI、图表、部门详情和明细表已同步联动。
```

不同状态说明：

| 状态 | 标题 | 明细 |
|---|---|---|
| 全部时间 | `当前：全部时间` | `未限制交易日期，KPI、图表、部门详情和明细表已同步联动。` |
| 年 | `当前：按年筛选` | `2026 全年，KPI、图表、部门详情和明细表已同步联动。` |
| 月 | `当前：按月筛选` | `2026-05，KPI、图表、部门详情和明细表已同步联动。` |
| 日 | `当前：按日筛选` | `2026-05-13，KPI、图表、部门详情和明细表已同步联动。` |
| 区间 | `当前：按日期区间筛选` | `2026-01-01 至 2026-05-31，KPI、图表、部门详情和明细表已同步联动。` |
| 正在设置区间 | `正在设置日期区间` | `选择开始/结束日期后点击“应用日期区间”；当前数据仍按原筛选展示。` |

### 19.1 日历切换按钮

按钮：

- `2026 年`
- `5 月`
- `按日`
- `区间`

高亮规则非常重要：

- 只有真正被选中的粒度按钮才能填色高亮。
- 用户只选了年份，没有选月份时，月份按钮不要填色。
- 用户只选了月份，没有选日时，日期格不要填色。
- 用户点击 `区间` 按钮时才显示日期区间输入框；不点击时必须隐藏。

### 19.2 年、月、日、区间行为

| 点击 | 行为 |
|---|---|
| 年按钮 | 设置 `period=YYYY`，清空 `date/dateStart/dateEnd`，日历显示 12 个月按钮 |
| 年视图中的月份 | 设置 `period=YYYY-MM`，切回月视图 |
| 月按钮 | 设置 `period=YYYY-MM`，显示该月日历格 |
| 按日按钮 | 进入日选择模式，但不立即改筛选，等待用户点某一天 |
| 日期格 | 设置 `date=YYYY-MM-DD`，同时保留 `period=YYYY-MM` 作为日历上下文 |
| 区间按钮 | 只展开日期区间输入框，不立即改变数据 |
| 应用日期区间 | 设置 `dateStart/dateEnd`，清空 `date/period` |

日历和筛选表必须双向同步：

- 改筛选表时间，日历切换到对应年/月/日/区间状态。
- 点日历，筛选表的时间下拉要同步追加并选中对应期间。

## 20. 右侧时间线任务栏

日历下方是时间线任务卡。

示例内容：

1. `费用口径确认`  
   `确认费用支出 1,518.8 万，原始流水 1,963.1 万。`
2. `未分类治理会`  
   `334.2 万疑似收入类，优先从费用口径剥离。`
3. `项目费用复盘`  
   `弹壳特攻队、美术中心、胡闹地牢进入项目明细。`

视觉：

- 左侧时间列，右侧任务卡。
- 重点任务使用浅绿色底。
- 底部按钮：`查看全部详情`。

点击时间线卡片可只做高亮，也可打开抽屉展示对应任务说明。

## 21. 右侧抽屉

抽屉宽度约 388px，从右侧滑出。

结构：

- 标题 `drawerTitle`
- 副标题 `drawerSubtitle`
- 关闭按钮
- 3 个 KPI 小块：
  - 当前金额
  - 命中明细
  - 最大单笔
- 原因拆解列表
- Top 明细列表

打开场景：

- KPI 卡片点击
- 趋势异常点点击
- 分类点击
- 部门点击
- 三级分类点击
- 明细行点击
- 未分类金额点击

抽屉内容要使用当前筛选后的数据，不要写死。

原因拆解建议：

```text
Top 分类：管理费用 723.1万
Top 部门：行政部 335.0万
图表点击、日历点击和筛选表使用同一套筛选状态。
```

## 22. 保存筛选视图

用户点击 `保存视图`：

1. 弹出中文命名输入框：`给这个筛选视图命名`。
2. 保存当前 `FilterState` 到 `localStorage.financeSavedViews`。
3. 在筛选 chip 附近显示已保存视图按钮。
4. 点击保存视图按钮可恢复该筛选状态。

数据结构：

```ts
type SavedView = {
  name: string;
  state: FilterState;
  createdAt: string;
};
```

## 23. 点击反馈

所有可点击卡片、按钮、图例、表格行、日历格、趋势柱都要有短暂高亮。

实现建议：

```css
.active-glow {
  outline: 2px solid rgba(37,125,96,.38);
  outline-offset: 2px;
  transition: .18s ease;
}
```

点击后 600ms 左右移除高亮。

选中筛选状态使用 `.is-filtered`：

```css
.is-filtered {
  outline: 2px solid rgba(37,125,96,.38);
  outline-offset: 2px;
}
```

## 24. 数据选择器

实现时建议把所有聚合计算放到 selectors，避免组件内部重复写逻辑。

必须实现：

```ts
filterRecords(records, state): ExpenseRecord[]
sumAmountCNY(records): number
formatMoney(cnyAmount, currencyMode): string
groupByAmount(records, key): Array<{ key: string; amountCNY: number }>
getKpis(records, state): KpiData
getTrendBuckets(records, state): TrendBucket[]
getCumulativeBuckets(records, state): Bucket[]
getCategoryDistribution(records, state): CategoryItem[]
getDepartmentRanking(records, state): DepartmentItem[]
getDepartmentDetail(records, state): DepartmentDetail
getTopRecords(records, state, limit): ExpenseRecord[]
```

`formatMoney`：

```ts
const RATE_USD_CNY = 7.2;

function formatMoney(cny: number, mode: 'CNY' | 'USD') {
  if (mode === 'USD') return `$${(cny / RATE_USD_CNY).toFixed(1)}万`;
  return `${cny.toFixed(1)}万`;
}
```

## 25. Mock 数据建议

未导入 Excel 前，可以用 mock 数据保持页面有内容。字段应覆盖：

- 两个主体：`北京格瑞拉科技有限公司`、`北京猿球科技有限公司`
- 部门/项目：`未分配部门`、`财务部`、`行政部`、`弹壳特攻队`、`美术中心`、`公共费用`、`人事行政`、`市场部`
- 一级分类：`管理费用`、`研发费用`、`人员成本`、`财务费用`、`销售费用`、`未分类`
- 交易类型：`expense`、`income`、`intercompany`、`unclassified`
- 导入状态：`normal`、`pending_classify`、`abnormal`
- 银行账户：`招商银行人民币户`、`民生银行人民币户`、`民生银行美元户`

示例月度序列：

```ts
const periods = [
  '2025-01','2025-02','2025-03','2025-04',
  '2025-05','2025-06','2025-07','2025-08',
  '2025-09','2025-10','2025-11','2025-12',
  '2026-01','2026-02','2026-03','2026-04'
];

const monthly = [
  88.9, 100.2, 124.3, 98.6,
  95.6, 126.1, 136.5, 140.1,
  138.9, 132.4, 126.8, 208.1,
  116.1, 104.2, 191.8, 33.6
];
```

## 26. 上传入口

正式版本需要在页面顶部或首次进入时提供明显上传区，但不要破坏当前 UI。建议放在筛选表上方或作为顶部按钮。

文案：

- 主按钮：`导入费用表格`
- 拖拽提示：`将 Excel 文件拖到这里，或点击选择文件`
- 支持格式：`支持 .xlsx / .xls`
- 导入中：`正在解析表格...`
- 导入成功：`导入完成，已生成财务分析报表`
- 导入失败：`导入失败，请检查表头、日期、金额和币种字段`

导入成功后，所有 mock 数据替换为 Excel 数据，并重算全页。

## 27. 验收标准

交付时必须满足：

- 页面整体看起来与 `finance-game-dashboard-sample3.html` 一致：三栏布局、浅色表格化卡片、右侧日历和时间线。
- 全部可见文案为中文。
- Excel 导入后能正确生成 `ExpenseRecord`。
- 全局筛选表、日历、图表点击使用同一套筛选状态。
- 年、月、日、日期区间筛选都能工作，且日历高亮不会误导用户。
- 日期区间选择器默认隐藏，只有点击 `区间` 才出现。
- 费用趋势总览根据时间筛选默认切换下一粒度，也支持手动选择年/季度/月/日。
- 月度累计分析根据当前时间段自动切换日、周、月粒度。
- 费用结构分布完整显示所有一级分类，并随时间和其他筛选联动。
- 点击分类可钻取二级和三级。
- 点击部门后，部门费用详情展示当前部门在当前筛选条件下的数据。
- 点击未分类金额进入待归类列表。
- 点击异常点或明细行打开抽屉，并显示原因和 Top 明细。
- 明细表底线对齐，不出现明显大空白。
- 保存筛选视图可用。
- 构建后是静态文件，可部署到 GitHub Pages、Vercel、Netlify 或公司静态服务器。

## 28. 给下一位 AI 的执行提示

请严格按本文档复刻 `finance-game-dashboard-sample3.html` 的 UI 和交互。不要重新设计成深色游戏风，也不要做首页宣传页。第一屏必须直接是财务分析仪表盘。实现时先搭三栏布局和静态卡片，再接入统一筛选状态，最后接入 Excel 导入和所有图表联动。

优先保证老板首次打开能立刻看懂：

1. 总费用是多少。
2. 哪些费用已确认，哪些待确认。
3. 哪个月或哪天异常高。
4. 最大费用分类是什么。
5. 哪个部门或项目花钱最多。
6. 点击任意图表能追到明细和原始 Excel 行号。
