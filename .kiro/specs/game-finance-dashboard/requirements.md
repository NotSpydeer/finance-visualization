# Requirements Document

## Introduction

游戏公司财务费用分析可视化平台是一个纯前端、全中文、可静态部署的 Excel 财务可视化工具。目标用户为游戏公司老板/CFO，用户打开网页后，将 Excel 费用流水表拖入或选择上传，即可在浏览器本地完成解析、清洗、筛选、图表分析和明细钻取，无需后端服务、数据库或登录系统。

## Glossary

- **Dashboard**: 费用分析仪表盘主界面，包含 KPI 卡片、趋势图、分类分布、部门排行、明细表等可视化组件
- **Parser**: Excel 文件解析模块，负责读取 .xlsx/.xls 文件并提取行列数据
- **Normalizer**: 数据标准化模块，负责将原始 Excel 行转换为 ExpenseRecord 结构
- **FilterEngine**: 全局筛选引擎，管理筛选状态并驱动所有组件联动刷新
- **ExpenseRecord**: 费用记录数据模型，包含 date、amount、amountCNY、currency、exchangeRate、categoryL1/L2/L3、department、person、bankAccount 等 16+ 字段
- **Selector**: 计算函数模块，基于筛选状态从 ExpenseRecord 集合中派生 KPI、趋势、分布等聚合结果
- **Drawer**: 右侧抽屉组件，展示点击 KPI、分类、部门、趋势柱、明细行后的详细构成信息
- **ImportStatus**: 导入质量状态枚举，包含 normal（正常）、pending_classify（待归类）、abnormal（异常）
- **CurrencyMode**: 币种展示口径，CNY 表示人民币口径、USD 表示美金口径
- **TrendGrain**: 趋势图时间粒度，包含 year（年）、quarter（季度）、month（月）、day（日）
- **SavedView**: 保存的筛选视图，存储于 localStorage，包含筛选状态快照和名称

## Requirements

### Requirement 1: Excel 文件导入

**User Story:** As a 游戏公司 CFO, I want to 通过拖拽或点击方式导入 Excel 费用表格, so that 可以快速开始费用分析而无需手动录入数据.

#### Acceptance Criteria

1. WHEN 用户将 .xlsx 或 .xls 文件拖放到上传区域, THE Parser SHALL 读取文件内容并开始解析流程
2. WHEN 用户点击上传按钮并选择 .xlsx 或 .xls 文件, THE Parser SHALL 读取文件内容并开始解析流程
3. WHEN 用户导入非 .xlsx 和非 .xls 格式的文件, THE Parser SHALL 显示中文错误提示「文件格式不支持，请导入 .xlsx 或 .xls 文件」
4. THE Parser SHALL 在浏览器本地完成文件解析，不向任何服务器上传文件数据
5. WHEN 用户再次导入新 Excel 文件, THE Dashboard SHALL 清空旧数据并使用新数据重新计算全部组件
6. WHILE 未导入任何数据, THE Dashboard SHALL 显示中文上传引导区域，包含拖拽提示和文件选择按钮

### Requirement 2: 表头自动识别与字段映射

**User Story:** As a CFO, I want to 系统自动识别中英文表头并映射到标准字段, so that 无需手动配置即可正确解析不同格式的费用表.

#### Acceptance Criteria

1. WHEN Excel 第一行包含已知的中文或英文表头别名, THE Parser SHALL 自动将表头映射为对应的 ExpenseRecord 标准字段
2. WHEN Excel 表头包含「日期」「交易日期」「记账日期」或「date」, THE Parser SHALL 将该列映射为 date 字段
3. WHEN Excel 表头包含「原币金额」「金额」「借方金额」「贷方金额」或「amount」, THE Parser SHALL 将该列映射为 amount 字段
4. WHEN Excel 表头包含「币种」「货币」或「currency」, THE Parser SHALL 将该列映射为 currency 字段
5. IF 未识别到日期字段, THEN THE Parser SHALL 显示中文提示「缺少交易日期字段，请检查 date/交易日期/日期 列」
6. IF 未识别到金额字段, THEN THE Parser SHALL 显示中文提示「缺少金额字段，请检查 amount/原币金额/金额 列」
7. IF 未识别到任何有效表头, THEN THE Parser SHALL 显示中文提示「未识别到有效表头，请检查第一行是否为字段名称」

### Requirement 3: 数据标准化

**User Story:** As a CFO, I want to Excel 数据自动标准化为统一格式, so that 不同来源的费用表都能正确分析.

#### Acceptance Criteria

1. WHEN date 列包含 Excel serial date 或 YYYY/MM/DD 或 YYYY-MM-DD 格式, THE Normalizer SHALL 统一输出为 YYYY-MM-DD 格式
2. WHEN periodMonth 字段缺失, THE Normalizer SHALL 从 date 字段截取前 7 位生成 YYYY-MM 格式的 periodMonth
3. WHEN currency 值为「RMB」「CNY」或「人民币」, THE Normalizer SHALL 统一转换为「RMB」
4. WHEN currency 值为「USD」或「美元」, THE Normalizer SHALL 统一转换为「USD」
5. WHEN currency 为 RMB 且 exchangeRate 缺失, THE Normalizer SHALL 将 exchangeRate 设为 1
6. WHEN currency 为 USD 且 exchangeRate 缺失, THE Normalizer SHALL 使用导入设置中的默认美元汇率
7. WHEN amountCNY 字段缺失, THE Normalizer SHALL 按公式 amount × exchangeRate 计算 amountCNY
8. WHEN amountCNY 字段存在, THE Normalizer SHALL 使用 Excel 中提供的 amountCNY 值
9. WHEN department 字段缺失, THE Normalizer SHALL 填入「未分配部门」
10. WHEN categoryL1 字段缺失, THE Normalizer SHALL 填入「未分类」并将 importStatus 设为 pending_classify
11. THE Normalizer SHALL 为每条记录生成唯一 id，格式为 importBatchId-sourceRowNo

### Requirement 4: 导入状态判定

**User Story:** As a CFO, I want to 系统自动标记每条记录的导入质量状态, so that 可以快速识别需要关注的异常数据.

#### Acceptance Criteria

1. WHEN 日期有效、金额为有效数字、币种为 RMB 或 USD、期间有效、且已分类, THE Normalizer SHALL 将 importStatus 设为 normal
2. WHEN 分类缺失或交易类型未识别或部门未分配，但金额有效, THE Normalizer SHALL 将 importStatus 设为 pending_classify
3. WHEN 日期无效或金额非数字或币种不支持, THE Normalizer SHALL 将 importStatus 设为 abnormal
4. WHEN currency 为 USD 且 exchangeRate 缺失且无默认汇率, THE Normalizer SHALL 将 importStatus 设为 abnormal
5. WHEN amountCNY 存在且与 amount × exchangeRate 的绝对差值超过 0.01, THE Normalizer SHALL 将 importStatus 设为 abnormal
6. IF 全部导入行均为 abnormal, THEN THE Parser SHALL 显示中文提示「没有可分析的数据，请检查日期、金额、币种和汇率」

### Requirement 5: 全局筛选状态管理

**User Story:** As a CFO, I want to 所有图表和组件共享同一套筛选条件, so that 切换筛选后全页数据同步刷新.

#### Acceptance Criteria

1. THE FilterEngine SHALL 维护包含 period、date、dateStart、dateEnd、person、department、categoryL1/L2/L3、bankAccount、currency、importStatus、currencyMode、trendGrain 的全局筛选状态
2. WHEN 任一筛选条件变更, THE Dashboard SHALL 使用新筛选状态重新计算并刷新所有可视化组件
3. WHEN date 精确日筛选存在, THE FilterEngine SHALL 以 date 为最高优先级时间筛选条件
4. WHEN date 为空且 dateStart/dateEnd 存在, THE FilterEngine SHALL 使用日期区间作为时间筛选条件
5. WHEN date 和日期区间均为空且 period 存在, THE FilterEngine SHALL 使用 period 作为时间筛选条件
6. THE Dashboard SHALL 在筛选标签区显示当前全部激活的筛选条件，每个标签支持点击清除

### Requirement 6: 筛选联动同步

**User Story:** As a CFO, I want to 日历、筛选表、图表点击三者双向同步, so that 无论从哪个入口操作都能获得一致的筛选结果.

#### Acceptance Criteria

1. WHEN 筛选表中时间条件变更, THE Dashboard SHALL 同步更新日历组件的选中状态
2. WHEN 日历中选择年、月、日或日期区间, THE FilterEngine SHALL 同步更新筛选状态中的对应时间字段
3. WHEN 用户点击图表中的趋势柱、分类、部门, THE FilterEngine SHALL 将点击对应的筛选条件写入全局筛选状态
4. WHEN 用户清除时间区间筛选标签, THE FilterEngine SHALL 同时清空 dateStart、dateEnd、date 和 period 字段
5. WHEN 用户切换时间筛选条件, THE FilterEngine SHALL 将 trendManual 重置为 false 并恢复默认趋势粒度

### Requirement 7: 币种展示口径

**User Story:** As a CFO, I want to 在人民币和美金口径之间切换查看费用数据, so that 可以从不同货币视角分析费用.

#### Acceptance Criteria

1. WHEN currencyMode 为 CNY, THE Dashboard SHALL 以人民币显示所有金额，格式为「X.X万」
2. WHEN currencyMode 为 USD, THE Dashboard SHALL 以美金显示所有金额，格式为「$X.X万」，计算公式为 amountCNY ÷ 默认美元汇率
3. WHEN 用户选择「仅 RMB 交易」, THE FilterEngine SHALL 仅展示 currency 为 RMB 的交易记录
4. WHEN 用户选择「仅 USD 交易」, THE FilterEngine SHALL 仅展示 currency 为 USD 的交易记录
5. THE Dashboard SHALL 在币种下拉中提供四个选项：全人民币口径、全美金口径、仅 RMB 交易、仅 USD 交易

### Requirement 8: KPI 总览卡片

**User Story:** As a CFO, I want to 一眼看到确认费用、原始金额、待确认金额和峰值金额, so that 快速掌握整体费用概况.

#### Acceptance Criteria

1. THE Dashboard SHALL 展示「确认费用支出」卡片，计算当前筛选下 transactionType 为 expense 且 importStatus 为 normal 的 amountCNY 合计
2. THE Dashboard SHALL 展示「原始交易金额」卡片，计算当前筛选下所有记录的 amountCNY 合计
3. THE Dashboard SHALL 展示「待确认金额」卡片，计算当前筛选下 importStatus 非 normal 或 categoryL1 为「未分类」的 amountCNY 合计
4. THE Dashboard SHALL 展示「峰值金额」卡片，计算当前筛选下按月份聚合后的最大月度金额
5. WHEN 用户点击待确认金额卡片, THE FilterEngine SHALL 设置 importStatus 为 pending_classify 且 categoryL1 为「未分类」
6. WHEN 用户点击峰值金额卡片, THE Dashboard SHALL 跳转至峰值月份并打开 Drawer 展示说明
7. WHEN 用户点击确认费用或原始金额卡片, THE Dashboard SHALL 打开 Drawer 展示当前口径明细和 Top 构成

### Requirement 9: 费用趋势总览

**User Story:** As a CFO, I want to 查看费用随时间变化的趋势, so that 识别费用增长或下降的模式.

#### Acceptance Criteria

1. WHEN 时间筛选为某年, THE Dashboard SHALL 默认以月粒度展示该年度 12 个月的费用趋势
2. WHEN 时间筛选为某月, THE Dashboard SHALL 默认以日粒度展示该月份每日的费用趋势
3. WHEN 时间筛选为某日, THE Dashboard SHALL 以日粒度展示该日所在月份的每日趋势，并以橙色高亮选中日
4. WHEN 时间筛选为日期区间, THE Dashboard SHALL 根据区间长度自动选择粒度：短区间用日、中区间用月、长区间用季度
5. WHILE 未设置时间筛选, THE Dashboard SHALL 以月粒度展示全部数据覆盖的月份趋势
6. WHEN 用户手动切换趋势粒度为年、季度、月或日, THE Dashboard SHALL 按用户选择的粒度重新聚合并展示趋势数据
7. WHEN 用户点击年趋势柱, THE FilterEngine SHALL 设置 period 为对应年份
8. WHEN 用户点击月趋势柱, THE FilterEngine SHALL 设置 period 为对应月份
9. WHEN 用户点击日趋势柱, THE FilterEngine SHALL 设置 date 为对应日期
10. WHEN 用户点击季度趋势柱, THE FilterEngine SHALL 设置 dateStart 和 dateEnd 为对应季度范围

### Requirement 10: 累计分析

**User Story:** As a CFO, I want to 查看当前时间段的累计费用和波动情况, so that 了解费用的增长节奏和稳定性.

#### Acceptance Criteria

1. WHEN 时间筛选为年, THE Dashboard SHALL 以月粒度展示累计分析
2. WHEN 时间筛选为月, THE Dashboard SHALL 以日粒度展示累计分析
3. WHEN 时间筛选为日, THE Dashboard SHALL 以日粒度展示该日所在月的累计分析
4. WHEN 时间筛选为日期区间且区间 ≤ 62 天, THE Dashboard SHALL 以日粒度展示累计分析
5. WHEN 时间筛选为日期区间且区间在 63 至 190 天之间, THE Dashboard SHALL 以周粒度展示累计分析
6. WHEN 时间筛选为日期区间且区间超过 190 天, THE Dashboard SHALL 以月粒度展示累计分析
7. THE Dashboard SHALL 展示三个摘要：峰值粒度及金额、当前时间段累计金额、波动率（计算公式为 (max - min) ÷ max × 100%）

### Requirement 11: 费用结构分布

**User Story:** As a CFO, I want to 查看各一级分类的费用占比和金额, so that 了解费用的结构组成.

#### Acceptance Criteria

1. THE Dashboard SHALL 展示所有一级分类的名称、金额和占比，不限制展示数量
2. THE Dashboard SHALL 以半环图形式按各一级分类占比动态绘制分布
3. WHEN 当前筛选条件变更, THE Dashboard SHALL 基于除 categoryL1/L2/L3 外的筛选条件重新计算分类分布
4. WHEN 用户点击某一级分类, THE FilterEngine SHALL 设置 categoryL1 为该分类并清空 categoryL2 和 categoryL3，同时打开 Drawer
5. WHEN 当前选中某一级分类, THE Dashboard SHALL 在分布图中高亮该分类
6. WHEN 当前筛选条件下无数据, THE Dashboard SHALL 将半环图显示为灰色并提示「当前口径无数据」

### Requirement 12: 分类钻取

**User Story:** As a CFO, I want to 从一级分类逐层钻取到二级、三级分类, so that 定位具体的费用构成明细.

#### Acceptance Criteria

1. WHILE 未选择任何分类, THE Dashboard SHALL 在分类钻取区域展示所有一级分类及金额
2. WHEN 用户点击某一级分类, THE Dashboard SHALL 展示该一级分类下的二级分类列表，并设置 categoryL1
3. WHEN 用户点击某二级分类, THE Dashboard SHALL 展示该二级分类下的三级分类列表，并设置 categoryL2
4. WHEN 用户点击某三级分类, THE FilterEngine SHALL 设置 categoryL3 并打开 Drawer 展示该三级分类的明细
5. WHEN 用户点击返回上级按钮, THE Dashboard SHALL 回退到上一层分类层级并清除对应筛选条件

### Requirement 13: 部门/项目费用排行

**User Story:** As a CFO, I want to 查看各部门的费用排行, so that 识别费用最高的部门.

#### Acceptance Criteria

1. THE Dashboard SHALL 基于除 department 外的当前筛选条件，按部门聚合金额并降序排列
2. WHEN 用户点击某部门, THE FilterEngine SHALL 设置 department 为该部门并打开 Drawer
3. WHEN 当前选中某部门, THE Dashboard SHALL 在排行列表中高亮该部门
4. THE Dashboard SHALL 对每个部门展示部门名称和当前口径下的金额

### Requirement 14: 部门费用详情

**User Story:** As a CFO, I want to 查看某部门的费用详情包括趋势和 Top 明细, so that 深入了解该部门的费用情况.

#### Acceptance Criteria

1. WHEN 用户选中某部门, THE Dashboard SHALL 展示该部门在当前筛选条件下的金额总计、命中明细条数和当前币种口径
2. WHEN 用户选中某部门, THE Dashboard SHALL 展示该部门近 6 个期间的费用趋势
3. WHEN 用户选中某部门, THE Dashboard SHALL 展示该部门金额最高的 4 条明细
4. WHILE 未选择任何部门, THE Dashboard SHALL 默认展示当前筛选下金额最高的部门的详情

### Requirement 15: 明细表

**User Story:** As a CFO, I want to 查看命中当前筛选条件的费用明细记录, so that 追溯具体的每笔费用.

#### Acceptance Criteria

1. THE Dashboard SHALL 展示当前筛选条件下的费用明细，列包含 date、person、department、categoryL1、categoryL3、bankAccount、amount、transactionType、sourceRowNo
2. THE Dashboard SHALL 默认展示前 10 条明细记录
3. WHEN 用户点击某明细行, THE Dashboard SHALL 打开 Drawer 展示该笔流水的 sourceRowNo、日期、部门、分类、银行账户、原币和当前口径金额

### Requirement 16: 日历筛选

**User Story:** As a CFO, I want to 通过日历选择年、月、日或日期区间进行时间筛选, so that 快速定位到特定时间段的费用数据.

#### Acceptance Criteria

1. THE Dashboard SHALL 在日历组件上方显示当前时间口径状态：按年、按月、按日、按日期区间、全部时间或正在设置日期区间
2. WHEN 用户在日历中点击某年, THE FilterEngine SHALL 设置 period 为该年份，且月份按钮和日期按钮不高亮
3. WHEN 用户在日历中点击某月, THE FilterEngine SHALL 设置 period 为该月份，且日期按钮不高亮
4. WHEN 用户在日历中点击某日, THE FilterEngine SHALL 设置 date 为该日期，且该日填色高亮
5. WHEN 用户选择日期区间模式并选定起止日期, THE FilterEngine SHALL 设置 dateStart 和 dateEnd，区间内日期显示浅色背景
6. WHEN 某日期存在异常记录, THE Dashboard SHALL 以边框形式提示该异常日期，不使用填色以避免与选中状态混淆

### Requirement 17: 右侧抽屉

**User Story:** As a CFO, I want to 点击图表元素后在抽屉中查看详细构成信息, so that 快速了解具体数字背后的原因.

#### Acceptance Criteria

1. WHEN 用户点击 KPI 卡片、趋势柱、分类、部门、三级分类或明细行, THE Drawer SHALL 打开并展示对应上下文的详细信息
2. THE Drawer SHALL 展示当前口径金额、命中笔数、最大单笔金额
3. THE Drawer SHALL 展示 Top 分类构成和 Top 部门构成
4. THE Drawer SHALL 展示金额最高的 6 条明细记录

### Requirement 18: 保存筛选视图

**User Story:** As a CFO, I want to 保存常用的筛选条件组合为视图, so that 下次可以一键恢复复杂的筛选状态.

#### Acceptance Criteria

1. WHEN 用户点击保存视图按钮, THE Dashboard SHALL 将当前 FilterState 快照保存到 localStorage
2. THE Dashboard SHALL 支持最多保存 6 个筛选视图
3. WHEN 用户点击已保存的视图, THE FilterEngine SHALL 恢复该视图的全部筛选条件并重新计算全页数据
4. THE Dashboard SHALL 为保存的视图自动生成名称，格式示例为「period:2026-03 / categoryL1:未分类」

### Requirement 19: 全中文界面

**User Story:** As a CFO, I want to 界面完全使用中文, so that 无语言障碍地使用该工具.

#### Acceptance Criteria

1. THE Dashboard SHALL 使用中文显示所有页面导航、筛选项、按钮、图表标题、表格列名、提示语、错误信息和抽屉文案
2. THE Dashboard SHALL 将英文导航项替换为中文，包括但不限于：Home→首页、Dashboard→总览、Reports→报表、Export→导出
3. WHEN 图表显示 tooltip, THE Dashboard SHALL 使用中文格式，例如「2026-03｜费用 191.8万」
4. WHEN 导入预览展示统计信息, THE Dashboard SHALL 使用中文标签，包括「总行数」「正常行」「待归类」「异常行」
5. WHEN 当前筛选条件下无明细数据, THE Dashboard SHALL 显示「当前筛选条件下暂无明细」

### Requirement 20: 纯前端静态部署

**User Story:** As a 开发者, I want to 项目构建后产出纯静态文件, so that 可以部署到任何静态站点而无需后端服务.

#### Acceptance Criteria

1. THE Dashboard SHALL 基于 Vite + React + TypeScript 构建
2. WHEN 执行 npm run build, THE Dashboard SHALL 生成不依赖 Node 服务的纯静态文件
3. THE Dashboard SHALL 使用浏览器 File API 和 xlsx 库在本地解析 Excel，不依赖后端 API
4. THE Dashboard SHALL 使用 localStorage 保存筛选视图，不依赖数据库
5. THE Dashboard SHALL 在页面底部或上传区域展示隐私提示「文件仅在当前浏览器本地解析，不会上传服务器」

### Requirement 21: 费用热力图

**User Story:** As a CFO, I want to 通过热力图直观查看费用在不同维度和时间上的分布强度, so that 快速发现费用集中区域.

#### Acceptance Criteria

1. THE Dashboard SHALL 展示热力图，行为一级分类或部门，列为当前时间窗口内的天或周
2. THE Dashboard SHALL 按金额区间对热力单元分为 4 个颜色等级，从低到高递增
3. WHEN 用户点击某热力单元, THE FilterEngine SHALL 增加对应分类和日期的筛选条件或打开 Drawer

### Requirement 22: 导入预览确认

**User Story:** As a CFO, I want to 在正式进入仪表盘前预览导入结果, so that 确认数据解析质量后再进行分析.

#### Acceptance Criteria

1. WHEN Excel 解析完成, THE Dashboard SHALL 展示导入预览，包含总行数、正常行数、待归类行数、异常行数和字段识别结果
2. WHEN 用户在导入预览中确认, THE Dashboard SHALL 进入仪表盘并基于导入数据生成全部可视化组件
3. THE Dashboard SHALL 在导入预览中以中文展示所有统计标签和字段映射结果

### Requirement 23: 本地数据缓存

**User Story:** As a CFO, I want to 刷新页面后可以选择恢复上次导入的数据, so that 不必每次都重新导入 Excel.

#### Acceptance Criteria

1. WHEN 用户导入数据成功, THE Dashboard SHALL 将导入数据缓存到 localStorage 或 IndexedDB
2. WHEN 用户刷新页面且存在缓存数据, THE Dashboard SHALL 提示用户「是否恢复上次导入的数据」
3. WHEN 用户选择不恢复, THE Dashboard SHALL 清除缓存并显示上传引导区域
4. WHEN 用户选择恢复, THE Dashboard SHALL 使用缓存数据重建仪表盘，无需重新导入文件
