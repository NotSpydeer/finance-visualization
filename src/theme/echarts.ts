/**
 * ECharts 自定义主题
 * 定义并注册 finance-dashboard 主题，统一仪表盘配色和图表样式
 * Requirements: 19.3
 */

import * as echarts from 'echarts';

/** 主题名称常量 */
export const FINANCE_THEME = 'finance-dashboard';

/** 中文系统字体栈 */
const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';

/** 约束配色方案：深绿、粉红、浅蓝、黄、橙、紫 */
const COLOR_PALETTE = [
  '#2a7041', // 深绿
  '#e85d75', // 粉红
  '#5ba4cf', // 浅蓝
  '#f5c542', // 黄
  '#ed8936', // 橙
  '#805ad5', // 紫
];

/** 坐标轴标签样式 */
const AXIS_LABEL_STYLE = {
  fontSize: 11,
  color: '#999',
  fontFamily: FONT_FAMILY,
};

/** 分割线样式（浅色虚线） */
const SPLIT_LINE_STYLE = {
  lineStyle: {
    type: 'dashed' as const,
    color: '#eee',
  },
};

/**
 * finance-dashboard 主题定义
 */
const theme: Record<string, unknown> = {
  color: COLOR_PALETTE,

  // 全局文本
  textStyle: {
    fontFamily: FONT_FAMILY,
  },

  // 标题样式
  title: {
    textStyle: {
      fontFamily: FONT_FAMILY,
      fontSize: 14,
      fontWeight: 500,
      color: '#333',
    },
  },

  // 图例：默认不显示
  legend: {
    show: false,
  },

  // Tooltip：白色背景、边框、阴影、中文格式
  tooltip: {
    backgroundColor: '#fff',
    borderColor: '#e8e8e8',
    borderWidth: 1,
    textStyle: {
      fontFamily: FONT_FAMILY,
      fontSize: 12,
      color: '#333',
    },
    extraCssText: 'box-shadow: 0 2px 8px rgba(0,0,0,0.12);',
  },

  // Grid：紧凑边距
  grid: {
    top: 40,
    right: 16,
    bottom: 32,
    left: 48,
    containLabel: false,
  },

  // 类目轴（X 轴）
  categoryAxis: {
    axisLine: {
      show: true,
      lineStyle: { color: '#ddd' },
    },
    axisTick: {
      show: false,
    },
    axisLabel: AXIS_LABEL_STYLE,
    splitLine: { show: false },
  },

  // 数值轴（Y 轴）
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: AXIS_LABEL_STYLE,
    splitLine: SPLIT_LINE_STYLE,
  },

  // 柱状图默认样式
  bar: {
    barMaxWidth: 32,
    itemStyle: {
      borderRadius: [3, 3, 0, 0],
    },
  },

  // 折线图默认样式
  line: {
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    lineStyle: {
      width: 2,
    },
  },

  // 饼图默认样式（半环图）
  pie: {
    radius: ['45%', '70%'],
    center: ['50%', '55%'],
    itemStyle: {
      borderColor: '#fff',
      borderWidth: 2,
    },
    label: {
      fontFamily: FONT_FAMILY,
      fontSize: 11,
      color: '#666',
    },
  },
};

/**
 * 注册 finance-dashboard 主题到 ECharts
 * 应在应用初始化时调用一次
 */
export function registerFinanceTheme(): void {
  echarts.registerTheme(FINANCE_THEME, theme);
}
