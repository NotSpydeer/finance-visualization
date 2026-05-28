/**
 * 待办事项面板
 * 右侧面板：日历下方
 * - 根据当前数据问题自动生成待办（如：有待分类记录、有异常记录等）
 * - 支持用户手动添加待办
 * - 支持打勾标记完成（划线样式）
 */

import { useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../state/store';
import type { PageKey } from '../state/store';

interface TodoItem {
  id: string;
  title: string;
  description: string;
  done: boolean;
  /** Auto-generated or user-created */
  source: 'auto' | 'user';
  /** Target page to navigate on click */
  targetPage?: PageKey;
}

let nextId = 1;
function genId() {
  return `todo-${nextId++}`;
}

export function TimelinePanel() {
  const records = useAppStore((s) => s.records);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  const [userTodos, setUserTodos] = useState<TodoItem[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [newTodoText, setNewTodoText] = useState('');
  const [showInput, setShowInput] = useState(false);

  // Auto-generate todos based on current data issues
  const autoTodos = useMemo((): TodoItem[] => {
    if (records.length === 0) return [];
    const items: TodoItem[] = [];

    const pendingClassify = records.filter((r) => r.importStatus === 'pending_classify');
    if (pendingClassify.length > 0) {
      items.push({
        id: 'auto-pending',
        title: `${pendingClassify.length} 条待分类记录`,
        description: '有记录尚未完成分类归属，需要人工确认',
        done: false,
        source: 'auto',
        targetPage: '费用治理',
      });
    }

    const abnormal = records.filter((r) => r.importStatus === 'abnormal');
    if (abnormal.length > 0) {
      items.push({
        id: 'auto-abnormal',
        title: `${abnormal.length} 条异常记录`,
        description: '存在异常数据需要核查处理',
        done: false,
        source: 'auto',
        targetPage: '费用治理',
      });
    }

    const unclassified = records.filter((r) => r.categoryL1 === '未分类');
    if (unclassified.length > 0) {
      items.push({
        id: 'auto-unclassified',
        title: `${unclassified.length} 条未分类费用`,
        description: '费用分类为"未分类"，需确认归属类别',
        done: false,
        source: 'auto',
        targetPage: '费用治理',
      });
    }

    const incomeInExpense = records.filter(
      (r) => r.transactionType === 'expense' && /收入|利息|分成|补贴|版权|期权/.test(r.categoryL3 || '')
    );
    if (incomeInExpense.length > 0) {
      items.push({
        id: 'auto-income-mix',
        title: `${incomeInExpense.length} 条疑似收入类`,
        description: '费用中可能混入收入类记录，建议复核',
        done: false,
        source: 'auto',
        targetPage: '费用治理',
      });
    }

    return items;
  }, [records]);

  const allTodos = useMemo(() => [...autoTodos, ...userTodos], [autoTodos, userTodos]);

  const handleToggle = useCallback((id: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleItemClick = useCallback((item: TodoItem) => {
    if (!item.targetPage) return;
    setCurrentPage(item.targetPage);
    // Only navigate, don't change filter state
  }, [setCurrentPage]);

  const handleAddTodo = useCallback(() => {
    if (!newTodoText.trim()) return;
    const newItem: TodoItem = {
      id: genId(),
      title: newTodoText.trim(),
      description: '',
      done: false,
      source: 'user',
    };
    setUserTodos((prev) => [...prev, newItem]);
    setNewTodoText('');
    setShowInput(false);
  }, [newTodoText]);

  const handleDeleteTodo = useCallback((id: string) => {
    setUserTodos((prev) => prev.filter((t) => t.id !== id));
    setCompletedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.head}>
        <span style={styles.headTitle}>待办事项</span>
        <button style={styles.addBtn} onClick={() => setShowInput(!showInput)}>
          {showInput ? '取消' : '+ 添加'}
        </button>
      </div>

      {/* Add todo input */}
      {showInput && (
        <div style={styles.inputRow}>
          <input
            type="text"
            placeholder="输入待办内容..."
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodo(); }}
            style={styles.todoInput}
            autoFocus
          />
          <button
            style={styles.confirmBtn}
            onClick={handleAddTodo}
            disabled={!newTodoText.trim()}
          >
            确认
          </button>
        </div>
      )}

      {/* Todo list */}
      {allTodos.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>✓</span>
          <span style={styles.emptyText}>暂无待办事项，数据状态良好</span>
        </div>
      ) : (
        <div style={styles.todoList}>
          {allTodos.map((item) => {
            const isDone = completedIds.has(item.id);
            return (
              <div key={item.id} style={{ ...styles.todoItem, ...(isDone ? styles.todoItemDone : {}) }}>
                {/* Checkbox */}
                <button
                  style={{ ...styles.checkbox, ...(isDone ? styles.checkboxDone : {}) }}
                  onClick={() => handleToggle(item.id)}
                  aria-label={isDone ? '标记为未完成' : '标记为已完成'}
                >
                  {isDone ? '✓' : ''}
                </button>
                {/* Content - clickable for auto items */}
                <div
                  style={styles.todoContent}
                  onClick={() => item.targetPage && handleItemClick(item)}
                  role={item.targetPage ? 'button' : undefined}
                  tabIndex={item.targetPage ? 0 : undefined}
                >
                  <span style={{ ...styles.todoTitle, ...(isDone ? styles.todoTitleDone : {}) }}>
                    {item.title}
                  </span>
                  {item.description && (
                    <span style={styles.todoDesc}>{item.description}</span>
                  )}
                  {item.targetPage && !isDone && (
                    <span style={styles.todoAction}>点击前往 → {item.targetPage}</span>
                  )}
                </div>
                {/* Delete button for user-created todos */}
                {item.source === 'user' && (
                  <button
                    style={styles.deleteBtn}
                    onClick={() => handleDeleteTodo(item.id)}
                    aria-label="删除待办"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text)',
  },
  addBtn: {
    fontSize: '11px',
    fontWeight: 800,
    color: 'var(--green)',
    border: '1px solid var(--green-2)',
    borderRadius: '5px',
    background: 'var(--green-3)',
    padding: '4px 10px',
    cursor: 'pointer',
  },
  inputRow: {
    display: 'flex',
    gap: '6px',
  },
  todoInput: {
    flex: 1,
    height: '32px',
    padding: '0 10px',
    fontSize: '12px',
    border: '1px solid var(--line)',
    borderRadius: '5px',
    background: '#fbfcfb',
    color: 'var(--text)',
    outline: 'none',
  },
  confirmBtn: {
    height: '32px',
    padding: '0 12px',
    fontSize: '11px',
    fontWeight: 800,
    border: '1px solid var(--green)',
    borderRadius: '5px',
    background: 'var(--green)',
    color: '#fff',
    cursor: 'pointer',
  },
  todoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  todoItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '10px 10px',
    borderRadius: '7px',
    border: '1px solid var(--line)',
    background: '#fbfcfb',
    transition: 'all .18s',
  },
  todoItemDone: {
    opacity: 0.6,
    background: '#f5f6f5',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    minWidth: '20px',
    borderRadius: '4px',
    border: '2px solid var(--line)',
    background: 'var(--surface)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 800,
    color: 'transparent',
    transition: 'all .15s',
    padding: 0,
    marginTop: '1px',
  },
  checkboxDone: {
    border: '2px solid var(--green)',
    background: 'var(--green)',
    color: '#fff',
  },
  todoContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
    cursor: 'pointer',
  },
  todoTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--text)',
    lineHeight: '1.3',
  },
  todoTitleDone: {
    textDecoration: 'line-through',
    color: 'var(--muted)',
  },
  todoDesc: {
    fontSize: '11px',
    color: 'var(--muted)',
    lineHeight: '1.4',
  },
  todoAction: {
    fontSize: '10px',
    color: 'var(--green)',
    fontWeight: 600,
    marginTop: '2px',
  },
  deleteBtn: {
    width: '20px',
    height: '20px',
    minWidth: '20px',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    transition: 'color .15s',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '24px 0',
  },
  emptyIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'var(--green-3)',
    color: 'var(--green)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 800,
  },
  emptyText: {
    fontSize: '12px',
    color: 'var(--muted)',
  },
};

export default TimelinePanel;
