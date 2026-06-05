#!/bin/bash
# Sprint 1 端到端验证脚本
set -e

BASE="http://localhost:3001/api"
PASS=0
FAIL=0

check() {
  local name="$1"
  local result="$2"
  if [ "$result" = "true" ]; then
    echo "  ✅ $name"
    PASS=$((PASS+1))
  else
    echo "  ❌ $name"
    FAIL=$((FAIL+1))
  fi
}

echo "========================================="
echo "Sprint 1 端到端验证"
echo "========================================="

# 1. Health Check
echo ""
echo "📋 1. 健康检查"
HEALTH=$(curl -s "$BASE/health")
check "API Health" "$(echo $HEALTH | python3 -c 'import sys,json; print("true" if json.load(sys.stdin)["status"]=="ok" else "false")' 2>/dev/null || echo false)"

# 2. 清空旧测试数据 + 创建连接
echo ""
echo "📋 2. 连接 CRUD"

# 列出已有连接
EXISTING=$(curl -s "$BASE/connections" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(len(d))" 2>/dev/null || echo 0)
echo "  现有连接数: $EXISTING"

# 创建新连接
CREATE_RESP=$(curl -s -X POST "$BASE/connections" \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E Test MySQL","type":"mysql","host":"127.0.0.1","port":13306,"username":"root","password":"root"}')
CONN_ID=$(echo $CREATE_RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
check "创建连接 (id=$CONN_ID)" "$([ -n "$CONN_ID" ] && echo true || echo false)"

# 获取连接
GET_RESP=$(curl -s "$BASE/connections/$CONN_ID")
check "获取单个连接" "$(echo $GET_RESP | python3 -c 'import sys,json; print("true" if json.load(sys.stdin)["data"]["name"]=="E2E Test MySQL" else "false")' 2>/dev/null || echo false)"

# 3. 测试连接
echo ""
echo "📋 3. 测试连接"
TEST_RESP=$(curl -s -X POST "$BASE/connections/test" \
  -H "Content-Type: application/json" \
  -d '{"type":"mysql","host":"127.0.0.1","port":13306,"username":"root","password":"root"}')
check "测试连接" "$(echo $TEST_RESP | python3 -c 'import sys,json; print("true" if json.load(sys.stdin)["data"]["connected"] else "false")' 2>/dev/null || echo false)"

VERSION=$(echo $TEST_RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['serverVersion'])" 2>/dev/null)
echo "  MySQL 版本: $VERSION"

# 4. 建立真实连接
echo ""
echo "📋 4. 建立数据库连接"
CONN_RESP=$(curl -s -X POST "$BASE/connections/$CONN_ID/connect")
check "建立连接" "$(echo $CONN_RESP | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]; print("true" if "serverVersion" in d else "false")' 2>/dev/null || echo false)"

DB_COUNT=$(echo $CONN_RESP | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['databases']))" 2>/dev/null)
echo "  数据库数量: $DB_COUNT"

# 5. 获取状态
echo ""
echo "📋 5. 连接状态"
STATUS_RESP=$(curl -s "$BASE/connections/$CONN_ID/status")
check "连接状态=connected" "$(echo $STATUS_RESP | python3 -c 'import sys,json; print("true" if json.load(sys.stdin)["data"]["status"]=="connected" else "false")' 2>/dev/null || echo false)"

# 6. 元数据
echo ""
echo "📋 6. 元数据查询"

# 数据库列表
DBS=$(curl -s "$BASE/metadata/$CONN_ID/databases")
check "获取数据库列表" "$(echo $DBS | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]; print("true" if len(d)>0 else "false")' 2>/dev/null || echo false)"

# 找到第一个有表的数据库（跳过 information_schema）
FIRST_DB=$(echo $DBS | python3 -c "
import sys,json
dbs=json.load(sys.stdin)['data']
for d in dbs:
    if d['name'] not in ('information_schema','performance_schema','sys'):
        print(d['name']); break
else:
    print(dbs[1]['name'] if len(dbs)>1 else dbs[0]['name'])
" 2>/dev/null)
echo "  首个数据库: $FIRST_DB"

# 表列表
TABLES=$(curl -s "$BASE/metadata/$CONN_ID/databases/$FIRST_DB/tables")
TABLE_COUNT=$(echo $TABLES | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>/dev/null)
check "获取表列表 ($TABLE_COUNT 张表)" "$([ "$TABLE_COUNT" != "0" ] && echo true || echo false)"

if [ "$TABLE_COUNT" != "0" ]; then
  # 获取第一张表
  FIRST_TABLE=$(echo $TABLES | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['name'])" 2>/dev/null)
  echo "  首张表: $FIRST_TABLE"

  # 列信息
  COLS=$(curl -s "$BASE/metadata/$CONN_ID/databases/$FIRST_DB/tables/$FIRST_TABLE/columns")
  COL_COUNT=$(echo $COLS | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>/dev/null)
  check "获取列信息 ($COL_COUNT 列)" "$([ "$COL_COUNT" != "0" ] && echo true || echo false)"

  # 索引
  IDX=$(curl -s "$BASE/metadata/$CONN_ID/databases/$FIRST_DB/tables/$FIRST_TABLE/indexes")
  IDX_COUNT=$(echo $IDX | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>/dev/null)
  check "获取索引 ($IDX_COUNT 个)" "$([ "$IDX_COUNT" != "0" ] && echo true || echo false)"

  # 建表语句
  CREATE_SQL=$(curl -s "$BASE/metadata/$CONN_ID/databases/$FIRST_DB/tables/$FIRST_TABLE/create-sql")
  check "获取建表语句" "$(echo $CREATE_SQL | python3 -c 'import sys,json; print("true" if json.load(sys.stdin)["data"]["createSQL"] else "false")' 2>/dev/null || echo false)"
fi

# 服务器信息
SINFO=$(curl -s "$BASE/metadata/$CONN_ID/server-info")
check "获取服务器信息" "$(echo $SINFO | python3 -c 'import sys,json; print("true" if json.load(sys.stdin)["data"]["version"] else "false")' 2>/dev/null || echo false)"

# 7. 执行 SQL
echo ""
echo "📋 7. 执行 SQL"

# SELECT 查询
QUERY_RESP=$(curl -s -X POST "$BASE/queries/execute" \
  -H "Content-Type: application/json" \
  -d "{\"connectionId\":\"$CONN_ID\",\"query\":\"SELECT 1 AS num, 'hello' AS greeting, NOW() AS ts\"}")
check "SELECT 查询" "$(echo $QUERY_RESP | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]; print("true" if d["rowCount"]==1 and len(d["columns"])==3 else "false")' 2>/dev/null || echo false)"

QDURATION=$(echo $QUERY_RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['duration'])" 2>/dev/null)
echo "  查询耗时: ${QDURATION}ms"

# 列类型识别
COL_TYPES=$(echo $QUERY_RESP | python3 -c "import sys,json; cols=json.load(sys.stdin)['data']['columns']; print([c['category'] for c in cols])" 2>/dev/null)
echo "  列类型: $COL_TYPES"

# SHOW DATABASES
SHOW_RESP=$(curl -s -X POST "$BASE/queries/execute" \
  -H "Content-Type: application/json" \
  -d "{\"connectionId\":\"$CONN_ID\",\"query\":\"SHOW DATABASES\"}")
SHOW_COUNT=$(echo $SHOW_RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['rowCount'])" 2>/dev/null)
check "SHOW DATABASES ($SHOW_COUNT 个)" "$([ "$SHOW_COUNT" != "0" ] && echo true || echo false)"

# 查询历史
HIST=$(curl -s "$BASE/queries/history?connectionId=$CONN_ID")
HIST_COUNT=$(echo $HIST | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>/dev/null)
check "查询历史 ($HIST_COUNT 条)" "$([ "$HIST_COUNT" != "0" ] && echo true || echo false)"

# 8. 断开连接
echo ""
echo "📋 8. 断开连接"
DISC=$(curl -s -X POST "$BASE/connections/$CONN_ID/disconnect")
check "断开连接" "$(echo $DISC | python3 -c 'import sys,json; print("true" if "message" in json.load(sys.stdin) else "false")' 2>/dev/null || echo false)"

STATUS_AFTER=$(curl -s "$BASE/connections/$CONN_ID/status")
check "状态变为 disconnected" "$(echo $STATUS_AFTER | python3 -c 'import sys,json; print("true" if json.load(sys.stdin)["data"]["status"]=="disconnected" else "false")' 2>/dev/null || echo false)"

# 9. 更新连接
echo ""
echo "📋 9. 更新连接"
UPDATE_RESP=$(curl -s -X PUT "$BASE/connections/$CONN_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E Updated"}')
check "更新连接名称" "$(echo $UPDATE_RESP | python3 -c 'import sys,json; print("true" if json.load(sys.stdin)["data"]["name"]=="E2E Updated" else "false")' 2>/dev/null || echo false)"

# 10. 删除连接
echo ""
echo "📋 10. 删除连接"
DEL_RESP=$(curl -s -X DELETE "$BASE/connections/$CONN_ID")
check "删除连接" "$(echo $DEL_RESP | python3 -c 'import sys,json; print("true" if "message" in json.load(sys.stdin) else "false")' 2>/dev/null || echo false)"

# 11. 配置持久化验证
echo ""
echo "📋 11. 配置持久化"
PERSIST_CHECK=$(curl -s -X POST "$BASE/connections" \
  -H "Content-Type: application/json" \
  -d '{"name":"Persist Test","type":"mysql","host":"127.0.0.1","port":13306,"username":"root"}')
PERSIST_ID=$(echo $PERSIST_CHECK | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
check "创建持久化测试连接" "$([ -n "$PERSIST_ID" ] && echo true || echo false)"

# 验证文件存在
if [ -f "$HOME/.reidisql/connections.json" ]; then
  FILE_COUNT=$(python3 -c "import json; print(len(json.load(open('$HOME/.reidisql/connections.json'))))" 2>/dev/null)
  check "配置文件存在且含 $FILE_COUNT 条记录" "true"
else
  check "配置文件存在" "false"
fi

# 清理
curl -s -X DELETE "$BASE/connections/$PERSIST_ID" > /dev/null 2>&1

# 总结
echo ""
echo "========================================="
echo "验证结果: ✅ $PASS 通过 / ❌ $FAIL 失败"
echo "========================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
