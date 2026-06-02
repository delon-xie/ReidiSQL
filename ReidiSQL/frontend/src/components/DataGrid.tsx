/**
 * 数据结果网格 — AG Grid 封装
 */

import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Empty, Tag } from 'antd';
import { useQueryStore } from '@/stores/queryStore';
import type { ColDef } from 'ag-grid-community';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const DataGrid: React.FC = () => {
  const { tabs, activeTabId } = useQueryStore();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const result = activeTab?.result;

  const columnDefs = useMemo<ColDef[]>(() => {
    if (!result?.columns?.length) return [];

    // 行号列
    const rowNumCol: ColDef = {
      headerName: '#',
      valueGetter: (params) => params.node?.rowIndex != null ? (params.node.rowIndex ?? 0) + 1 : '',
      width: 60,
      pinned: 'left',
      suppressMovable: true,
      cellStyle: { color: '#999', textAlign: 'center' },
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
      cellStyle: (params): Record<string, string | number> => {
        const val = params.value;
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

    return [rowNumCol, ...dataCols];
  }, [result]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80,
  }), []);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 结果摘要 */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 12, color: '#666', display: 'flex', gap: 12 }}>
        <span>行数: {result.rowCount}{result.hasMore ? '+' : ''}</span>
        <span>耗时: {result.duration}ms</span>
        <span>列数: {result.columns.length}</span>
      </div>

      {/* AG Grid */}
      <div className="ag-theme-alpine" style={{ flex: 1, minHeight: 200 }}>
        <AgGridReact
          rowData={result.rows}
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
        />
      </div>
    </div>
  );
};

export default DataGrid;
