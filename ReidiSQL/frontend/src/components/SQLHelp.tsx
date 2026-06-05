/**
 * SQLHelp — SQL 帮助参考组件 (Sprint 4)
 */

import React, { useState, useMemo } from 'react';
import { Modal, Input, Collapse, Tag, Space, Typography } from 'antd';
import { BookOutlined, SearchOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface SQLHelpProps {
  open: boolean;
  onClose: () => void;
}

interface SQLFunction {
  name: string;
  syntax: string;
  description: string;
}

interface SQLCategory {
  category: string;
  functions: SQLFunction[];
}

const SQL_REFERENCE: SQLCategory[] = [
  {
    category: '字符串函数',
    functions: [
      { name: 'CONCAT', syntax: 'CONCAT(str1, str2, ...)', description: '连接多个字符串' },
      { name: 'LENGTH', syntax: 'LENGTH(str)', description: '返回字符串字节长度' },
      { name: 'CHAR_LENGTH', syntax: 'CHAR_LENGTH(str)', description: '返回字符串字符长度' },
      { name: 'SUBSTRING', syntax: 'SUBSTRING(str, pos, len)', description: '截取子串' },
      { name: 'UPPER', syntax: 'UPPER(str)', description: '转大写' },
      { name: 'LOWER', syntax: 'LOWER(str)', description: '转小写' },
      { name: 'TRIM', syntax: 'TRIM([remstr FROM] str)', description: '去除首尾空格' },
      { name: 'REPLACE', syntax: 'REPLACE(str, from, to)', description: '替换子串' },
      { name: 'LPAD', syntax: 'LPAD(str, len, padstr)', description: '左填充' },
      { name: 'RPAD', syntax: 'RPAD(str, len, padstr)', description: '右填充' },
      { name: 'REVERSE', syntax: 'REVERSE(str)', description: '反转字符串' },
      { name: 'LEFT', syntax: 'LEFT(str, len)', description: '返回左边 len 个字符' },
      { name: 'RIGHT', syntax: 'RIGHT(str, len)', description: '返回右边 len 个字符' },
    ],
  },
  {
    category: '日期时间函数',
    functions: [
      { name: 'NOW', syntax: 'NOW()', description: '当前日期时间' },
      { name: 'CURDATE', syntax: 'CURDATE()', description: '当前日期' },
      { name: 'CURTIME', syntax: 'CURTIME()', description: '当前时间' },
      { name: 'DATE', syntax: 'DATE(expr)', description: '提取日期部分' },
      { name: 'TIME', syntax: 'TIME(expr)', description: '提取时间部分' },
      { name: 'DATE_FORMAT', syntax: 'DATE_FORMAT(date, format)', description: '格式化日期' },
      { name: 'DATE_ADD', syntax: 'DATE_ADD(date, INTERVAL expr unit)', description: '日期加法' },
      { name: 'DATE_SUB', syntax: 'DATE_SUB(date, INTERVAL expr unit)', description: '日期减法' },
      { name: 'DATEDIFF', syntax: 'DATEDIFF(date1, date2)', description: '日期差天数' },
      { name: 'TIMESTAMPDIFF', syntax: 'TIMESTAMPDIFF(unit, dt1, dt2)', description: '时间戳差' },
      { name: 'UNIX_TIMESTAMP', syntax: 'UNIX_TIMESTAMP([date])', description: '转为 Unix 时间戳' },
      { name: 'FROM_UNIXTIME', syntax: 'FROM_UNIXTIME(timestamp)', description: 'Unix 时间戳转日期' },
    ],
  },
  {
    category: '聚合函数',
    functions: [
      { name: 'COUNT', syntax: 'COUNT(expr)', description: '计数' },
      { name: 'SUM', syntax: 'SUM(expr)', description: '求和' },
      { name: 'AVG', syntax: 'AVG(expr)', description: '平均值' },
      { name: 'MAX', syntax: 'MAX(expr)', description: '最大值' },
      { name: 'MIN', syntax: 'MIN(expr)', description: '最小值' },
      { name: 'GROUP_CONCAT', syntax: 'GROUP_CONCAT(expr [SEPARATOR str])', description: '分组拼接' },
      { name: 'STDDEV', syntax: 'STDDEV(expr)', description: '标准差' },
    ],
  },
  {
    category: '数学函数',
    functions: [
      { name: 'ABS', syntax: 'ABS(x)', description: '绝对值' },
      { name: 'CEIL', syntax: 'CEIL(x)', description: '向上取整' },
      { name: 'FLOOR', syntax: 'FLOOR(x)', description: '向下取整' },
      { name: 'ROUND', syntax: 'ROUND(x [, d])', description: '四舍五入' },
      { name: 'MOD', syntax: 'MOD(n, m)', description: '取模' },
      { name: 'POW', syntax: 'POW(x, y)', description: '幂运算' },
      { name: 'SQRT', syntax: 'SQRT(x)', description: '平方根' },
      { name: 'RAND', syntax: 'RAND()', description: '随机数 (0~1)' },
    ],
  },
  {
    category: '条件与流程控制',
    functions: [
      { name: 'IF', syntax: 'IF(expr, true_val, false_val)', description: '条件判断' },
      { name: 'IFNULL', syntax: 'IFNULL(expr1, expr2)', description: '为 NULL 替换' },
      { name: 'NULLIF', syntax: 'NULLIF(expr1, expr2)', description: '相等则返回 NULL' },
      { name: 'COALESCE', syntax: 'COALESCE(val1, val2, ...)', description: '返回第一个非 NULL' },
      { name: 'CASE', syntax: 'CASE [expr] WHEN ... THEN ... [ELSE ...] END', description: '多条件分支' },
      { name: 'GREATEST', syntax: 'GREATEST(val1, val2, ...)', description: '返回最大值' },
      { name: 'LEAST', syntax: 'LEAST(val1, val2, ...)', description: '返回最小值' },
    ],
  },
  {
    category: 'JSON 函数',
    functions: [
      { name: 'JSON_EXTRACT', syntax: "JSON_EXTRACT(doc, '$.key')", description: '提取 JSON 值' },
      { name: 'JSON_UNQUOTE', syntax: 'JSON_UNQUOTE(val)', description: '去除 JSON 引号' },
      { name: 'JSON_SET', syntax: "JSON_SET(doc, '$.key', val)", description: '设置 JSON 值' },
      { name: 'JSON_ARRAY', syntax: 'JSON_ARRAY(val1, val2, ...)', description: '创建 JSON 数组' },
      { name: 'JSON_OBJECT', syntax: "JSON_OBJECT('k1', v1, 'k2', v2)", description: '创建 JSON 对象' },
      { name: 'JSON_LENGTH', syntax: 'JSON_LENGTH(doc)', description: 'JSON 元素个数' },
    ],
  },
  {
    category: '常用关键字',
    functions: [
      { name: 'SELECT', syntax: 'SELECT col1, col2 FROM table [WHERE ...] [ORDER BY ...] [LIMIT ...]', description: '查询数据' },
      { name: 'INSERT', syntax: 'INSERT INTO table (col1, col2) VALUES (v1, v2)', description: '插入数据' },
      { name: 'UPDATE', syntax: 'UPDATE table SET col=val [WHERE ...]', description: '更新数据' },
      { name: 'DELETE', syntax: 'DELETE FROM table [WHERE ...]', description: '删除数据' },
      { name: 'JOIN', syntax: 'table1 [INNER|LEFT|RIGHT] JOIN table2 ON ...', description: '表连接' },
      { name: 'GROUP BY', syntax: 'GROUP BY col [HAVING ...]', description: '分组聚合' },
      { name: 'UNION', syntax: 'SELECT ... UNION [ALL] SELECT ...', description: '合并结果集' },
      { name: 'CREATE INDEX', syntax: 'CREATE [UNIQUE] INDEX idx ON table (col)', description: '创建索引' },
    ],
  },
];

const SQLHelp: React.FC<SQLHelpProps> = ({ open, onClose }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return SQL_REFERENCE;
    const keyword = search.toLowerCase();
    return SQL_REFERENCE.map(cat => ({
      ...cat,
      functions: cat.functions.filter(f =>
        f.name.toLowerCase().includes(keyword) ||
        f.description.toLowerCase().includes(keyword) ||
        f.syntax.toLowerCase().includes(keyword)
      ),
    })).filter(cat => cat.functions.length > 0);
  }, [search]);

  return (
    <Modal
      title={<><BookOutlined /> SQL 参考手册</>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
      destroyOnClose
    >
      <Input
        prefix={<SearchOutlined />}
        placeholder="搜索函数或关键字..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        allowClear
        style={{ marginBottom: 16 }}
      />
      <div style={{ maxHeight: 450, overflow: 'auto' }}>
        <Collapse
          defaultActiveKey={SQL_REFERENCE.map(c => c.category)}
          ghost
          items={filtered.map(cat => ({
            key: cat.category,
            label: <Tag color="blue">{cat.category} ({cat.functions.length})</Tag>,
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cat.functions.map(f => (
                  <div key={f.name} style={{ padding: '4px 8px', background: '#fafafa', borderRadius: 4 }}>
                    <Space>
                      <Text strong style={{ fontFamily: 'monospace' }}>{f.name}</Text>
                      <Text type="secondary">{f.description}</Text>
                    </Space>
                    <div>
                      <Text code style={{ fontSize: 12 }}>{f.syntax}</Text>
                    </div>
                  </div>
                ))}
              </div>
            ),
          }))}
        />
      </div>
    </Modal>
  );
};

export default SQLHelp;
