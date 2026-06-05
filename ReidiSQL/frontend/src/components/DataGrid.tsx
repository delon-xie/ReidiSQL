/**
 * 数据结果网格 — AG Grid 封装 + 内联编辑 + 右键菜单
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Empty, Tag, Button, Space, Popconfirm, message, Tooltip, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined, DeleteOutlined, SaveOutlined, UndoOutlined, ExportOutlined,
  CopyOutlined, FilterOutlined, SortAscendingOutlined, SortDescendingOutlined,
} from '@ant-design/icons';
import { useQueryStore } from '@/stores/queryStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { dataApi, type DataOperation } from '@/lib/api';
import type { ColDef, CellValueChangedEvent, CellContextMenuEvent } from 'ag-grid-community';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

interface DataGridProps {
  onExport?: () => void;
  isDark?: boolean;
  onFilterValue?: (column: string, value: string) => void;
}

/** 行状态标记 */
type RowStatus = 'original' | 'modified' | 'added' | 'deleted';

interface EditableRow {
  __rowStatus: RowStatus;
  __originalData?: Record<string, unknown>;
  [key: string]: unknown;
}

/** 右键菜单上下文 */
interface ContextMenuState {
  x: number;
  y: number;
  column: string;
  value: unknown;
  rowIndex: number;
}

const DataGrid: React.FC<DataGridProps> = ({ onExport, isDark = false, onFilterValue }) => {
  const { tabs, activeTabId } = useQueryStore();
  const { activeConnectionId, activeDatabase } = useConnectionStore();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const result = activeTab?.result;

  const gridRef = useRef<AgGridReact>(null);
  const [editableRows, setEditableRows] = useState<EditableRow[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // 当查询结果变化时重置可编辑行
  useMemo(() => {
    if (result?.rows) {
      setEditableRows(
        result.rows.map(row => ({
          ...row,
          __rowStatus: 'original' as RowStatus,
          __originalData: { ...row },
        }))
      );
      setHasChanges(false);
    }
  }, [result]);

  // 提取当前表名（从 SQL 中解析）
  const currentTable = useMemo(() => {
    if (!activeTab?.sql) return '';
    const match = activeTab.sql.match(/FROM\s+[`"']?(\w+)[`"']?/i);
    return match?.[1] || '';
  }, [activeTab?.sql]);

  const columnDefs = useMemo<ColDef[]>(() => {
    if (!result?.columns?.length) return [];

    // 状态列
    const statusCol: ColDef = {
      headerName: '#',
      valueGetter: (params) => params.node?.rowIndex != null ? (params.node.rowIndex ?? 0) + 1 : '',
      width: 60,
      pinned: 'left',
      suppressMovable: true,
      cellStyle: (params): Record<string, string | number> => {
        const row = params.data as EditableRow;
        if (row.__rowStatus === 'added') return { color: '#52c41a', textAlign: 'center', fontWeight: 'bold' };
        if (row.__rowStatus === 'modified') return { color: '#faad14', textAlign: 'center', fontWeight: 'bold' };
        if (row.__rowStatus === 'deleted') return { color: '#ff4d4f', textAlign: 'center', textDecoration: 'line-through' };
        return { color: '#999', textAlign: 'center' };
      },
    };

    const dataCols: ColDef[] = result.columns.map(col => ({
      headerName: col.name,
      field: col.name,
      headerTooltip: `${col.type} (${col.category})${col.nullable ? '' : ' NOT NULL'}`,
      minWidth: 100,
      width: col.category === 'text' ? 200 : col.category === 'binary' ? 120 : 130,
      sortable: true,
      filter: true,
      resizable: true,
      editable: col.category !== 'binary', // 二进制列不可编辑
      cellStyle: (params): Record<string, string | number> => {
        const row = params.data as EditableRow;
        const val = params.value;

        // 删除的行用红色和划线
        if (row.__rowStatus === 'deleted') return { color: '#ff4d4f', textDecoration: 'line-through' };

        // 检查值是否变化
        if (row.__originalData && row.__originalData[col.name] !== val) {
          return { backgroundColor: '#fff7e6', fontWeight: 'bold' };
        }

        if (val === null || val === undefined) return { color: '#bbb', fontStyle: 'italic' };
        if (col.category === 'integer' || col.category === 'real') return { textAlign: 'right', fontFamily: 'monospace' };
        if (col.category === 'binary') return { color: '#888', fontFamily: 'monospace', fontSize: '12px' };
        if (col.category === 'temporal') return { color: '#0958d9' };
        return {};
      },
      valueFormatter: (params) => {
        if (params.value === null) return 'NULL';
        if (params.value === undefined) return '';
        if (typeof params.value === 'object') return JSON.stringify(params.value);
        return String(params.value);
      },
    }));

    return [statusCol, ...dataCols];
  }, [result]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80,
  }), []);

  // 单元格值变更
  const handleCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const rowIndex = event.rowIndex;
    if (rowIndex === null) return;

    setEditableRows(prev => {
      const rows = [...prev];
      const row = { ...rows[rowIndex] };
      row[event.column.getColId()] = event.newValue;

      if (row.__rowStatus === 'original') {
        row.__rowStatus = 'modified';
      }
      rows[rowIndex] = row;
      return rows;
    });
    setHasChanges(true);
  }, []);

  // 添加新行
  const handleAddRow = useCallback(() => {
    if (!result?.columns?.length) return;

    const newRow: EditableRow = { __rowStatus: 'added' };
    result.columns.forEach(col => {
      newRow[col.name] = null;
    });

    setEditableRows(prev => [...prev, newRow]);
    setHasChanges(true);
  }, [result]);

  // 删除选中行
  const handleDeleteRows = useCallback(() => {
    const selectedNodes = gridRef.current?.api?.getSelectedNodes() || [];
    if (selectedNodes.length === 0) {
      message.warning('请先选择要删除的行');
      return;
    }

    setEditableRows(prev => {
      const rows = [...prev];
      selectedNodes.forEach(node => {
        const idx = node.rowIndex;
        if (idx !== null) {
          if (rows[idx].__rowStatus === 'added') {
            // 新增的行直接移除
            rows.splice(idx, 1);
          } else {
            // 已有行标记为删除
            rows[idx] = { ...rows[idx], __rowStatus: 'deleted' };
          }
        }
      });
      return rows;
    });
    setHasChanges(true);
  }, []);

  // 撤销所有变更
  const handleUndo = useCallback(() => {
    if (result?.rows) {
      setEditableRows(
        result.rows.map(row => ({
          ...row,
          __rowStatus: 'original' as RowStatus,
          __originalData: { ...row },
        }))
      );
      setHasChanges(false);
      message.info('已撤销所有变更');
    }
  }, [result]);

  // 右键菜单处理
  const handleCellContextMenu = useCallback((event: CellContextMenuEvent) => {
    event.event?.preventDefault();
    const colId = event.column?.getColId() || '';
    const value = event.value;
    const rowIndex = event.rowIndex ?? 0;
    const mouseEvent = event.event as MouseEvent;
    setContextMenu({
      x: mouseEvent.clientX,
      y: mouseEvent.clientY,
      column: colId,
      value,
      rowIndex,
    });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleCopyCell = useCallback(() => {
    if (contextMenu) {
      const text = contextMenu.value === null ? 'NULL' : String(contextMenu.value);
      navigator.clipboard.writeText(text).then(() => message.success('已复制'));
    }
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  const handleCopyAsInsert = useCallback(() => {
    if (!contextMenu || !currentTable || !result?.columns) { closeContextMenu(); return; }
    const row = editableRows[contextMenu.rowIndex];
    if (!row) { closeContextMenu(); return; }

    const cols = result.columns.map(c => `\`${c.name}\``).join(', ');
    const vals = result.columns.map(c => {
      const v = row[c.name];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'number') return String(v);
      return `'${String(v).replace(/'/g, "''")}'`;
    }).join(', ');

    const sql = `INSERT INTO \`${currentTable}\` (${cols}) VALUES (${vals});`;
    navigator.clipboard.writeText(sql).then(() => message.success('已复制 INSERT 语句'));
    closeContextMenu();
  }, [contextMenu, currentTable, result, editableRows, closeContextMenu]);

  const handleCopyAsCSV = useCallback(() => {
    if (!contextMenu || !result?.columns) { closeContextMenu(); return; }
    const row = editableRows[contextMenu.rowIndex];
    if (!row) { closeContextMenu(); return; }

    const header = result.columns.map(c => c.name).join(',');
    const values = result.columns.map(c => {
      const v = row[c.name];
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');

    navigator.clipboard.writeText(`${header}\n${values}`).then(() => message.success('已复制为 CSV'));
    closeContextMenu();
  }, [contextMenu, result, editableRows, closeContextMenu]);

  const handleCopyAsJSON = useCallback(() => {
    if (!contextMenu || !result?.columns) { closeContextMenu(); return; }
    const row = editableRows[contextMenu.rowIndex];
    if (!row) { closeContextMenu(); return; }

    const obj: Record<string, unknown> = {};
    result.columns.forEach(c => { obj[c.name] = row[c.name] ?? null; });
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2)).then(() => message.success('已复制为 JSON'));
    closeContextMenu();
  }, [contextMenu, result, editableRows, closeContextMenu]);

  const handleSetNull = useCallback(() => {
    if (!contextMenu) { closeContextMenu(); return; }
    setEditableRows(prev => {
      const rows = [...prev];
      const row = { ...rows[contextMenu.rowIndex] };
      row[contextMenu.column] = null;
      if (row.__rowStatus === 'original') row.__rowStatus = 'modified';
      rows[contextMenu.rowIndex] = row;
      return rows;
    });
    setHasChanges(true);
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  const handleFilterThisValue = useCallback(() => {
    if (!contextMenu) { closeContextMenu(); return; }
    const val = contextMenu.value === null ? 'NULL' : String(contextMenu.value);
    onFilterValue?.(contextMenu.column, val);
    closeContextMenu();
  }, [contextMenu, onFilterValue, closeContextMenu]);

  const handleSortAsc = useCallback(() => {
    if (!contextMenu) { closeContextMenu(); return; }
    gridRef.current?.api?.applyColumnState({ state: [{ colId: contextMenu.column, sort: 'asc' }] });
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  const handleSortDesc = useCallback(() => {
    if (!contextMenu) { closeContextMenu(); return; }
    gridRef.current?.api?.applyColumnState({ state: [{ colId: contextMenu.column, sort: 'desc' }] });
    closeContextMenu();
  }, [contextMenu, closeContextMenu]);

  const contextMenuItems: MenuProps['items'] = contextMenu ? [
    { key: 'copy', icon: <CopyOutlined />, label: '复制', onClick: handleCopyCell },
    { key: 'copy-insert', label: '复制为 INSERT', onClick: handleCopyAsInsert },
    { key: 'copy-csv', label: '复制为 CSV', onClick: handleCopyAsCSV },
    { key: 'copy-json', label: '复制为 JSON', onClick: handleCopyAsJSON },
    { type: 'divider' },
    { key: 'set-null', label: '设为 NULL', onClick: handleSetNull },
    { key: 'delete-row', icon: <DeleteOutlined />, label: '删除选中行', onClick: () => { handleDeleteRows(); closeContextMenu(); } },
    { type: 'divider' },
    { key: 'filter', icon: <FilterOutlined />, label: `过滤: ${contextMenu.column} = ${String(contextMenu.value ?? 'NULL').slice(0, 20)}`, onClick: handleFilterThisValue },
    { key: 'sort-asc', icon: <SortAscendingOutlined />, label: '升序排序', onClick: handleSortAsc },
    { key: 'sort-desc', icon: <SortDescendingOutlined />, label: '降序排序', onClick: handleSortDesc },
  ] : [];

  // 提交变更
  const handleCommit = useCallback(async () => {
    if (!activeConnectionId || !activeDatabase || !currentTable) {
      message.warning('缺少连接/数据库/表信息');
      return;
    }

    const operations: DataOperation[] = [];
    const pkColumns = result?.columns?.filter(c => c.name.toLowerCase() === 'id' || c.name.toLowerCase().includes('_id')) || [];

    for (const row of editableRows) {
      if (row.__rowStatus === 'added') {
        const data: Record<string, unknown> = {};
        result?.columns?.forEach(col => {
          if (row[col.name] !== null && row[col.name] !== undefined) {
            data[col.name] = row[col.name];
          }
        });
        if (Object.keys(data).length > 0) {
          operations.push({ type: 'insert', data });
        }
      } else if (row.__rowStatus === 'modified' && row.__originalData) {
        const data: Record<string, unknown> = {};
        const where: Record<string, unknown> = {};

        result?.columns?.forEach(col => {
          if (row[col.name] !== row.__originalData![col.name]) {
            data[col.name] = row[col.name];
          }
        });

        // WHERE 条件用原始主键值
        pkColumns.forEach(col => {
          where[col.name] = row.__originalData![col.name];
        });

        if (Object.keys(data).length > 0 && Object.keys(where).length > 0) {
          operations.push({ type: 'update', data, where });
        }
      } else if (row.__rowStatus === 'deleted' && row.__originalData) {
        const where: Record<string, unknown> = {};
        pkColumns.forEach(col => {
          where[col.name] = row.__originalData![col.name];
        });
        if (Object.keys(where).length > 0) {
          operations.push({ type: 'delete', where });
        }
      }
    }

    if (operations.length === 0) {
      message.info('没有需要提交的变更');
      return;
    }

    setCommitting(true);
    try {
      const res = await dataApi.batch(activeConnectionId, activeDatabase, currentTable, operations);
      if (res.success) {
        message.success(`提交成功，影响行数: ${res.affectedRows}`);
        setHasChanges(false);
      } else {
        message.error(`提交失败: ${res.errors?.[0]?.error || '未知错误'}`);
      }
    } catch (err: any) {
      message.error(`提交失败: ${err.message}`);
    } finally {
      setCommitting(false);
    }
  }, [activeConnectionId, activeDatabase, currentTable, editableRows, result]);

  if (!result) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Empty description="执行查询以查看结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  // DDL/DML 结果（无列）
  if (!result.columns.length) {
    return (
      <div style={{ padding: 16 }}>
        <Tag color="green">执行成功</Tag>
        <span style={{ marginLeft: 8 }}>
          {result.affectedRows !== undefined && `影响行数: ${result.affectedRows}`}
          {result.insertId !== undefined && ` | Last Insert ID: ${result.insertId}`}
          {' '}耗时: {result.duration}ms
        </span>
      </div>
    );
  }

  const addedCount = editableRows.filter(r => r.__rowStatus === 'added').length;
  const modifiedCount = editableRows.filter(r => r.__rowStatus === 'modified').length;
  const deletedCount = editableRows.filter(r => r.__rowStatus === 'deleted').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 工具栏 */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size="small">
          <span style={{ fontSize: 12, color: '#666' }}>
            行数: {result.rowCount}{result.hasMore ? '+' : ''} | 耗时: {result.duration}ms | 列: {result.columns.length}
          </span>
          {hasChanges && (
            <span style={{ fontSize: 12 }}>
              {addedCount > 0 && <Tag color="green">+{addedCount}</Tag>}
              {modifiedCount > 0 && <Tag color="orange">~{modifiedCount}</Tag>}
              {deletedCount > 0 && <Tag color="red">-{deletedCount}</Tag>}
            </span>
          )}
        </Space>
        <Space size="small">
          <Tooltip title="新增行">
            <Button size="small" icon={<PlusOutlined />} onClick={handleAddRow} />
          </Tooltip>
          <Tooltip title="删除选中行">
            <Button size="small" danger icon={<DeleteOutlined />} onClick={handleDeleteRows} />
          </Tooltip>
          {hasChanges && (
            <>
              <Tooltip title="撤销变更">
                <Button size="small" icon={<UndoOutlined />} onClick={handleUndo} />
              </Tooltip>
              <Popconfirm
                title={`确认提交 ${addedCount + modifiedCount + deletedCount} 项变更？`}
                onConfirm={handleCommit}
                okText="确认"
                cancelText="取消"
              >
                <Button size="small" type="primary" icon={<SaveOutlined />} loading={committing}>
                  提交
                </Button>
              </Popconfirm>
            </>
          )}
          {onExport && (
            <Tooltip title="导出">
              <Button size="small" icon={<ExportOutlined />} onClick={onExport} />
            </Tooltip>
          )}
        </Space>
      </div>

      {/* AG Grid */}
      <div className="ag-theme-alpine" style={{ flex: 1, minHeight: 200, ...(isDark ? { filter: 'invert(0.88) hue-rotate(180deg)' } : {}) }}>
        <AgGridReact
          ref={gridRef as any}
          rowData={editableRows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          pagination
          paginationPageSize={200}
          paginationAutoPageSize={false}
          enableCellTextSelection
          rowSelection="multiple"
          suppressCellFocus={false}
          animateRows={false}
          rowHeight={28}
          headerHeight={32}
          onCellValueChanged={handleCellValueChanged}
          onCellContextMenu={handleCellContextMenu}
          getRowStyle={(params): Record<string, string | number> | undefined => {
            const row = params.data as EditableRow;
            if (row?.__rowStatus === 'added') return { backgroundColor: '#f6ffed' };
            if (row?.__rowStatus === 'deleted') return { backgroundColor: '#fff1f0' };
            return undefined;
          }}
        />
      </div>

      {/* 右键菜单 */}
      {contextMenu && contextMenuItems && contextMenuItems.length > 0 && (
        <Dropdown
          menu={{ items: contextMenuItems }}
          open
          onOpenChange={(open) => { if (!open) closeContextMenu(); }}
          trigger={['click']}
        >
          <div
            style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, width: 1, height: 1 }}
            onClick={closeContextMenu}
          />
        </Dropdown>
      )}
    </div>
  );
};

export default DataGrid;
