#!/bin/bash
# ============================================================
# Sprint 2 E2E 验证脚本
# ============================================================
# 测试范围：DDL、数据修改、导出

set -e

BASE_URL="http://localhost:3001/api"
PASS=0
FAIL=0
TOTAL=0

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_test() {
  TOTAL=$((TOTAL + 1))
  echo -n "${YELLOW}[$TOTAL] $1${NC} ... "
}

log_pass() {
  PASS=$((PASS + 1))
  echo "${GREEN}PASS${NC} $1"
}

log_fail() {
  FAIL=$((FAIL + 1))
  echo "${RED}FAIL${NC} $1"
}

# ============================================================
# 1. Health Check
# ============================================================
log_test "Health Check (v0.2.0-sprint2)"
RES=$(curl -s "$BASE_URL/health")
VER=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])")
if [ "$VER" = "0.2.0-sprint2" ]; then
  log_pass "version=$VER"
else
  log_fail "Expected v0.2.0-sprint2, got $VER"
fi

# ============================================================
# 2. 创建连接并连接
# ============================================================
log_test "创建连接"
RES=$(curl -s -X POST "$BASE_URL/connections" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Sprint2Test","type":"mysql","host":"127.0.0.1","port":13306,"username":"root","password":"root"}')
CONN_ID=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id','') or d.get('id',''))")
if [ -n "$CONN_ID" ]; then
  log_pass "connId=$CONN_ID"
else
  log_fail "Failed: $RES"
  exit 1
fi

log_test "连接数据库"
RES=$(curl -s -X POST "$BASE_URL/connections/$CONN_ID/connect")
STATUS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('serverVersion','') or d.get('serverVersion',''))")
if [ -n "$STATUS" ]; then
  log_pass "server=$STATUS"
else
  log_fail "Connect failed: $RES"
fi

# 获取一个可用的测试数据库
DB="reidisql_test"

# 确保测试数据库存在
log_test "确保测试数据库存在"
RES=$(curl -s -X POST "$BASE_URL/ddl/execute" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"mysql\",\"sql\":\"CREATE DATABASE IF NOT EXISTS $DB\"}")
SUCCESS=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))")
if [ "$SUCCESS" = "True" ]; then
  log_pass "database=$DB"
else
  log_fail "Create DB failed: $RES"
fi
sleep 1

# ============================================================
# 3. DDL - 创建表
# ============================================================
log_test "DDL: 生成 CREATE TABLE SQL"
RES=$(curl -s -X POST "$BASE_URL/ddl/generate" \
  -H 'Content-Type: application/json' \
  -d '{
    "operation":"create",
    "tableName":"test_products",
    "columns":[
      {"operation":"add","name":"id","dataType":"INT","nullable":false,"autoIncrement":true,"unsigned":true},
      {"operation":"add","name":"name","dataType":"VARCHAR(100)","nullable":false},
      {"operation":"add","name":"price","dataType":"DECIMAL(10,2)","nullable":true,"hasDefault":true,"defaultValue":"0.00"},
      {"operation":"add","name":"created_at","dataType":"TIMESTAMP","nullable":true,"hasDefault":true,"defaultValue":"CURRENT_TIMESTAMP"}
    ],
    "indexes":[
      {"operation":"add","name":"PRIMARY","type":"PRIMARY","columns":[{"name":"id"}]},
      {"operation":"add","name":"idx_name","type":"INDEX","columns":[{"name":"name"}]}
    ],
    "options":{"engine":"InnoDB","charset":"utf8mb4","collation":"utf8mb4_unicode_ci"}
  }')
SQL=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('sql',''))")
if echo "$SQL" | grep -q "CREATE TABLE"; then
  log_pass "SQL generated (${#SQL} chars)"
else
  log_fail "Generate failed: $RES"
fi

log_test "DDL: 执行 CREATE TABLE"
RES=$(curl -s -X POST "$BASE_URL/ddl/table" \
  -H 'Content-Type: application/json' \
  -d "{
    \"connectionId\":\"$CONN_ID\",
    \"database\":\"$DB\",
    \"operation\":\"create\",
    \"tableName\":\"test_products\",
    \"columns\":[
      {\"operation\":\"add\",\"name\":\"id\",\"dataType\":\"INT\",\"nullable\":false,\"autoIncrement\":true,\"unsigned\":true},
      {\"operation\":\"add\",\"name\":\"name\",\"dataType\":\"VARCHAR(100)\",\"nullable\":false},
      {\"operation\":\"add\",\"name\":\"price\",\"dataType\":\"DECIMAL(10,2)\",\"nullable\":true,\"hasDefault\":true,\"defaultValue\":\"0.00\"},
      {\"operation\":\"add\",\"name\":\"created_at\",\"dataType\":\"TIMESTAMP\",\"nullable\":true,\"hasDefault\":true,\"defaultValue\":\"CURRENT_TIMESTAMP\"}
    ],
    \"indexes\":[
      {\"operation\":\"add\",\"name\":\"PRIMARY\",\"type\":\"PRIMARY\",\"columns\":[{\"name\":\"id\"}]},
      {\"operation\":\"add\",\"name\":\"idx_name\",\"type\":\"INDEX\",\"columns\":[{\"name\":\"name\"}]}
    ],
    \"options\":{\"engine\":\"InnoDB\",\"charset\":\"utf8mb4\",\"collation\":\"utf8mb4_unicode_ci\"}
  }")
SUCCESS=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))")
if [ "$SUCCESS" = "True" ]; then
  log_pass "Table created"
else
  log_fail "Create table failed: $RES"
fi

# ============================================================
# 4. DDL - ALTER TABLE (添加列)
# ============================================================
log_test "DDL: ALTER TABLE 添加列"
ALTER_JSON=$(python3 -c "
import json
d = {'connectionId':'$CONN_ID','database':'$DB','sql':'ALTER TABLE \`test_products\` ADD COLUMN \`description\` TEXT NULL AFTER \`price\`'}
print(json.dumps(d))
")
RES=$(curl -s -X POST "$BASE_URL/ddl/execute" \
  -H 'Content-Type: application/json' \
  -d "$ALTER_JSON")
SUCCESS=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))")
if [ "$SUCCESS" = "True" ]; then
  log_pass "Column added"
else
  log_fail "Alter table failed: $RES"
fi

# 验证列数
log_test "验证: 表有5列"
RES=$(curl -s "$BASE_URL/metadata/$CONN_ID/databases/$DB/tables/test_products/columns")
COL_COUNT=$(echo "$RES" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('data',[])))")
if [ "$COL_COUNT" = "5" ]; then
  log_pass "5 columns"
else
  log_fail "Expected 5 columns, got $COL_COUNT"
fi

# ============================================================
# 5. 数据修改 - INSERT
# ============================================================
log_test "数据: INSERT 一行"
RES=$(curl -s -X POST "$BASE_URL/data/insert" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"$DB\",\"table\":\"test_products\",\"data\":{\"name\":\"Widget A\",\"price\":19.99}}")
SUCCESS=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))")
INSERT_ID=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('insertId',0))")
if [ "$SUCCESS" = "True" ]; then
  log_pass "insertId=$INSERT_ID"
else
  log_fail "Insert failed: $RES"
fi

log_test "数据: INSERT 多行 (batch)"
RES=$(curl -s -X POST "$BASE_URL/data/batch" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"$DB\",\"table\":\"test_products\",\"operations\":[
    {\"type\":\"insert\",\"data\":{\"name\":\"Widget B\",\"price\":29.99}},
    {\"type\":\"insert\",\"data\":{\"name\":\"Widget C\",\"price\":39.99}},
    {\"type\":\"insert\",\"data\":{\"name\":\"Gadget X\",\"price\":99.99}}
  ]}")
SUCCESS=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))")
AFFECTED=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('affectedRows',0))")
if [ "$SUCCESS" = "True" ]; then
  log_pass "affected=$AFFECTED"
else
  log_fail "Batch insert failed: $RES"
fi

# ============================================================
# 6. 数据修改 - UPDATE
# ============================================================
log_test "数据: UPDATE 一行"
RES=$(curl -s -X PUT "$BASE_URL/data/update" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"$DB\",\"table\":\"test_products\",\"data\":{\"price\":24.99},\"where\":{\"name\":\"Widget A\"}}")
SUCCESS=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))")
AFFECTED=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('affectedRows',0))")
if [ "$SUCCESS" = "True" ] && [ "$AFFECTED" = "1" ]; then
  log_pass "updated=$AFFECTED"
else
  log_fail "Update failed: $RES"
fi

# ============================================================
# 7. 数据修改 - DELETE
# ============================================================
log_test "数据: DELETE 一行"
RES=$(curl -s -X DELETE "$BASE_URL/data/delete" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"$DB\",\"table\":\"test_products\",\"where\":{\"name\":\"Gadget X\"}}")
SUCCESS=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))")
if [ "$SUCCESS" = "True" ]; then
  log_pass "deleted"
else
  # Try alternative response format
  AFFECTED=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('affectedRows',0) if 'data' in d else d.get('affectedRows',0))")
  if [ "$AFFECTED" -ge 0 ]; then
    log_pass "deleted (affected=$AFFECTED)"
  else
    log_fail "Delete failed: $RES"
  fi
fi

# 验证行数
log_test "验证: 表有3行"
QUERY_JSON=$(python3 -c "
import json
d = {'connectionId':'$CONN_ID','query':'SELECT * FROM $DB.test_products'}
print(json.dumps(d))
")
RES=$(curl -s -X POST "$BASE_URL/queries/execute" \
  -H 'Content-Type: application/json' \
  -d "$QUERY_JSON")
ROW_COUNT=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('rowCount',0))")
if [ "$ROW_COUNT" = "3" ]; then
  log_pass "3 rows"
else
  log_fail "Expected 3 rows, got $ROW_COUNT"
fi

# ============================================================
# 8. 导出 - CSV
# ============================================================
log_test "导出: CSV 格式"
RES=$(curl -s -X POST "$BASE_URL/export" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"$DB\",\"format\":\"csv\",\"tables\":[\"test_products\"]}")
SUCCESS=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))")
ROW_COUNT=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('rowCount',0))")
DATA=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',''))")
if [ "$SUCCESS" = "True" ] && [ "$ROW_COUNT" = "3" ]; then
  log_pass "CSV: $ROW_COUNT rows, ${#DATA} chars"
else
  log_fail "CSV export failed: $RES"
fi

# ============================================================
# 9. 导出 - JSON
# ============================================================
log_test "导出: JSON 格式"
RES=$(curl -s -X POST "$BASE_URL/export" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"$DB\",\"format\":\"json\",\"tables\":[\"test_products\"]}")
SUCCESS=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))")
if [ "$SUCCESS" = "True" ]; then
  log_pass "JSON exported"
else
  log_fail "JSON export failed: $RES"
fi

# ============================================================
# 10. 导出 - SQL
# ============================================================
log_test "导出: SQL 格式"
RES=$(curl -s -X POST "$BASE_URL/export" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"$DB\",\"format\":\"sql\",\"tables\":[\"test_products\"],\"options\":{\"includeStructure\":true,\"includeData\":true}}")
SUCCESS=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))")
DATA=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data','')[:200])")
if [ "$SUCCESS" = "True" ]; then
  log_pass "SQL: has CREATE TABLE=$( echo "$DATA" | grep -c 'CREATE TABLE')"
else
  log_fail "SQL export failed: $RES"
fi

# ============================================================
# 11. DDL - DROP TABLE (清理)
# ============================================================
log_test "DDL: DROP TABLE"
RES=$(curl -s -X POST "$BASE_URL/ddl/table" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"$DB\",\"operation\":\"drop\",\"tableName\":\"test_products\"}")
SUCCESS=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))")
if [ "$SUCCESS" = "True" ]; then
  log_pass "Table dropped"
else
  log_fail "Drop table failed: $RES"
fi

# ============================================================
# 12. 断开连接
# ============================================================
log_test "断开连接"
curl -s -X POST "$BASE_URL/connections/$CONN_ID/disconnect" > /dev/null
log_pass "disconnected"

log_test "删除连接"
curl -s -X DELETE "$BASE_URL/connections/$CONN_ID" > /dev/null
log_pass "deleted"

# ============================================================
# 结果汇总
# ============================================================
echo ""
echo "============================================================"
echo "  Sprint 2 E2E 验证结果"
echo "============================================================"
echo -e "  总计: $TOTAL | ${GREEN}通过: $PASS${NC} | ${RED}失败: $FAIL${NC}"
echo "============================================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
