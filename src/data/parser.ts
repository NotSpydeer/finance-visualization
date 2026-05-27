/**
 * Excel 解析模块
 *
 * 负责读取 Excel 文件、识别表头、映射字段。
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1-2.7
 */

import * as XLSX from 'xlsx';
import { HEADER_ALIASES } from './headerAliases';
import type { ParseResult, ParseError, FieldMapping, RawRow } from '../types/expense';

/**
 * 解析 Excel 文件，提取原始行数据和字段映射。
 *
 * @param file - 用户上传的 File 对象
 * @returns ParseResult 包含行数据、字段映射和错误信息
 */
export async function parseExcel(file: File): Promise<ParseResult> {
  // 文件格式校验
  const formatError = validateFileFormat(file.name, file.type);
  if (formatError) {
    return {
      success: false,
      rows: [],
      fieldMapping: {},
      errors: [formatError],
    };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // 取第一个 worksheet
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return {
        success: false,
        rows: [],
        fieldMapping: {},
        errors: [
          {
            type: 'no_valid_headers',
            message: '未识别到有效表头，请检查第一行是否为字段名称',
          },
        ],
      };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });

    if (jsonData.length === 0) {
      return {
        success: false,
        rows: [],
        fieldMapping: {},
        errors: [
          {
            type: 'no_valid_headers',
            message: '未识别到有效表头，请检查第一行是否为字段名称',
          },
        ],
      };
    }

    // 第一行作为表头
    const rawHeader = jsonData[0] ?? [];
    const headerRow = Array.from(rawHeader, (cell) => String(cell ?? ''));
    const fieldMapping = recognizeHeaders(headerRow);

    // 后备策略：如果没有识别到 currency 字段，尝试从数据行推断
    if (!fieldMapping['currency'] && jsonData.length > 1) {
      const sampleRow = jsonData[1];
      for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
        if (fieldMapping['currency']) break;
        const cellValue = String(sampleRow[colIdx] ?? '').trim().toUpperCase();
        if (['RMB', 'CNY', 'USD', '人民币', '美元'].includes(cellValue)) {
          // 找到了币种列
          // 如果表头为空，给它一个内部名字并把它设为映射
          if (!headerRow[colIdx]) {
            headerRow[colIdx] = `__currency_col__`;
          }
          fieldMapping['currency'] = headerRow[colIdx];
          break;
        }
      }
    }

    // 调试：打印前3行原始数据和字段映射
    console.log('[DEBUG] headerRow:', JSON.stringify(headerRow));
    console.log('[DEBUG] fieldMapping:', JSON.stringify(fieldMapping));
    if (jsonData.length > 1) {
      console.log('[DEBUG] row1 raw:', JSON.stringify(jsonData[1]));
    }
    if (jsonData.length > 2) {
      console.log('[DEBUG] row2 raw:', JSON.stringify(jsonData[2]));
    }

    // 检查必填字段
    const errors: ParseError[] = [];

    if (Object.keys(fieldMapping).length === 0) {
      errors.push({
        type: 'no_valid_headers',
        message: '未识别到有效表头，请检查第一行是否为字段名称',
      });
      return { success: false, rows: [], fieldMapping, errors };
    }

    if (!fieldMapping['date']) {
      errors.push({
        type: 'missing_header',
        message: '缺少交易日期字段，请检查 date/交易日期/日期 列',
      });
    }

    if (!fieldMapping['amount']) {
      errors.push({
        type: 'missing_header',
        message: '缺少金额字段，请检查 amount/原币金额/金额 列',
      });
    }

    if (errors.length > 0) {
      return { success: false, rows: [], fieldMapping, errors };
    }

    // 将数据行转为 RawRow 对象（跳过表头行）
    const rows: RawRow[] = [];
    for (let i = 1; i < jsonData.length; i++) {
      const rowArray = jsonData[i];
      if (!rowArray || rowArray.length === 0) continue;

      const row: RawRow = {};
      for (let j = 0; j < headerRow.length; j++) {
        const header = headerRow[j];
        if (header) {
          row[header] = rowArray[j] ?? undefined;
        }
      }
      rows.push(row);
    }

    return { success: true, rows, fieldMapping, errors: [] };
  } catch (e) {
    return {
      success: false,
      rows: [],
      fieldMapping: {},
      errors: [
        {
          type: 'invalid_format',
          message: `文件解析失败：${e instanceof Error ? e.message : '请确认文件未损坏'}`,
        },
      ],
    };
  }
}

/**
 * 识别表头行，将实际列名映射到标准字段名。
 *
 * 对每个表头单元格进行 trim + 大小写不敏感匹配，
 * 在 HEADER_ALIASES 中查找对应的标准字段名。
 *
 * @param headerRow - 表头行的字符串数组
 * @returns FieldMapping 标准字段名 → 实际列名
 */
export function recognizeHeaders(headerRow: string[]): FieldMapping {
  const mapping: FieldMapping = {};

  for (const cell of headerRow) {
    if (cell == null) continue;
    const trimmed = String(cell).trim();
    if (!trimmed) continue;

    // 归一化：转小写 + 多空格合并为单空格
    const normalizedCell = trimmed.toLowerCase().replace(/\s+/g, ' ');

    for (const [standardField, aliases] of Object.entries(HEADER_ALIASES)) {
      // 跳过已映射的标准字段
      if (mapping[standardField]) continue;

      const matched = aliases.some(
        (alias) => alias.toLowerCase().replace(/\s+/g, ' ') === normalizedCell
      );

      if (matched) {
        mapping[standardField] = trimmed;
        break;
      }
    }
  }

  return mapping;
}

/**
 * 校验文件是否为 Excel 格式（通过扩展名或 MIME type）
 */
function validateFileFormat(fileName: string, mimeType?: string): ParseError | null {
  const lowerName = fileName.toLowerCase();
  
  // 支持的扩展名（检查文件名是否以这些结尾）
  const validExtensions = ['.xlsx', '.xls', '.xlsm', '.xlsb'];
  const extensionValid = validExtensions.some(ext => lowerName.endsWith(ext));
  
  // 支持的 MIME types
  const validMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream',
  ];
  const mimeValid = mimeType && validMimeTypes.includes(mimeType);
  
  if (!extensionValid && !mimeValid) {
    return {
      type: 'invalid_format',
      message: '文件格式不支持，请导入 .xlsx 或 .xls 文件',
    };
  }
  return null;
}
