#!/bin/bash
# ============================================================
# Sprint 3 E2E 验证脚本
# ============================================================
# 测试范围：CSV 导入、视图/存储过程/函数/触发器 CRUD

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
# 1. Health Check (v0.3.0-sprint3)
# ============================================================
log_test "Health Check (v0.3.0-sprint3)"
RES=$(curl -s "$BASE_URL/health")
VER=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])")
if [ "$VER" = "0.3.0-sprint3" ]; then
  log_pass "version=$VER"
else
  log_fail "Expected v0.3.0-sprint3, got $VER"
fi

# ============================================================
# 2. 创建连接并连接
# ============================================================
log_test "创建连接"
RES=$(curl -s -X POST "$BASE_URL/connections" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Sprint3Test","type":"mysql","host":"127.0.0.1","port":13306,"username":"root","password":"root"}')
CONN_ID=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id','') or d.get('id',''))")
if [ -n "$CONN_ID" ]; then
  log_pass "connId=$CONN_ID"
else
  log_fail "Failed: $RES"
  exit 1
fi

log_test "连接到数据库"
RES=$(curl -s -X POST "$BASE_URL/connections/$CONN_ID/connect")
SV=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('serverVersion','') or d.get('serverVersion',''))")
if [ -n "$SV" ]; then
  log_pass "serverVersion=$SV"
else
  log_fail "Failed: $RES"
  exit 1
fi

# ============================================================
# 3. 创建测试数据库
# ============================================================
log_test "创建测试数据库 sprint3_test"
python3 -c "
import urllib.request, json
data = json.dumps({'connectionId':'$CONN_ID','database':'mysql','sql':'DROP DATABASE IF EXISTS sprint3_test; CREATE DATABASE sprint3_test DEFAULT CHARACTER SET utf8mb4'}).encode()
req = urllib.request.Request('$BASE_URL/ddl/execute', data=data, headers={'Content-Type':'application/json'}, method='POST')
res = json.loads(urllib.request.urlopen(req).read())
print('OK' if res.get('success',True) else json.dumps(res))
" | grep -q OK && log_pass "" || log_fail "Failed to create database"

# 创建测试表
log_test "创建测试表 users"
python3 -c "
import urllib.request, json
data = json.dumps({'connectionId':'$CONN_ID','database':'sprint3_test','sql':'CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), email VARCHAR(100), age INT)'}).encode()
req = urllib.request.Request('$BASE_URL/ddl/execute', data=data, headers={'Content-Type':'application/json'}, method='POST')
res = json.loads(urllib.request.urlopen(req).read())
print('OK' if res.get('success',True) else json.dumps(res))
" | grep -q OK && log_pass "" || log_fail "Failed to create table"

# ============================================================
# 4. CSV 格式检测
# ============================================================
log_test "CSV 格式检测"
python3 << PYEOF
import urllib.request, json, sys
csv_content = "name,email,age\\nAlice,alice@test.com,25\\nBob,bob@test.com,30\\nCharlie,charlie@test.com,35"
data = json.dumps({"content": csv_content}).encode()
req = urllib.request.Request("$BASE_URL/import/detect", data=data, headers={"Content-Type":"application/json"}, method="POST")
res = json.loads(urllib.request.urlopen(req).read())
hh = res.get("hasHeader", False)
rc = res.get("rowCount", 0)
if hh and rc == 3:
    print(f"PASS hasHeader={hh}, rowCount={rc}")
else:
    print(f"FAIL hasHeader={hh}, rowCount={rc}")
    sys.exit(1)
PYEOF
if [ $? -eq 0 ]; then log_pass "(see above)"; else log_fail ""; fi

# ============================================================
# 5. CSV 导入执行
# ============================================================
log_test "CSV 导入到 users 表"
python3 << PYEOF
import urllib.request, json, sys
csv_content = "name,email,age\\nAlice,alice@test.com,25\\nBob,bob@test.com,30\\nCharlie,charlie@test.com,35"
data = json.dumps({
    "connectionId": "$CONN_ID",
    "database": "sprint3_test",
    "table": "users",
    "content": csv_content,
    "options": {"hasHeader": True, "insertMode": "INSERT"}
}).encode()
req = urllib.request.Request("$BASE_URL/import/execute", data=data, headers={"Content-Type":"application/json"}, method="POST")
try:
    res = json.loads(urllib.request.urlopen(req).read())
except urllib.error.HTTPError as e:
    res = json.loads(e.read())
s = res.get("success", False)
ir = res.get("importedRows", 0)
errors = res.get("errors", [])
if s and ir == 3:
    print(f"PASS imported={ir}")
else:
    print(f"FAIL success={s}, imported={ir}, errors={errors}")
    sys.exit(1)
PYEOF
if [ $? -eq 0 ]; then log_pass "(see above)"; else log_fail ""; fi

# 验证数据
log_test "验证导入数据"
RES=$(curl -s -X POST "$BASE_URL/queries/execute" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"query\":\"SELECT COUNT(*) as cnt FROM sprint3_test.users\"}")
CNT=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); rows=d.get('data',{}).get('rows',[]); print(rows[0].get('cnt',0) if rows else 0)")
if [ "$CNT" = "3" ]; then
  log_pass "count=$CNT"
else
  log_fail "Expected 3 rows, got $CNT"
fi

# ============================================================
# 6. 视图 CRUD
# ============================================================
log_test "创建视图 user_view"
RES=$(curl -s -X POST "$BASE_URL/objects/view" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"sprint3_test\",\"name\":\"user_view\",\"definition\":\"SELECT id, name, email FROM users WHERE age > 20\",\"operation\":\"create\"}")
V_SUCCESS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))")
if [ "$V_SUCCESS" = "True" ]; then
  log_pass ""
else
  log_fail "Failed: $RES"
fi

log_test "获取视图定义"
RES=$(curl -s "$BASE_URL/objects/VIEW/user_view/code?connectionId=$CONN_ID&database=sprint3_test")
CODE=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('code','')))")
if [ "$CODE" -gt "10" ]; then
  log_pass "code_len=$CODE"
else
  log_fail "Failed: $RES"
fi

log_test "修改视图 (ALTER)"
RES=$(curl -s -X POST "$BASE_URL/objects/view" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"sprint3_test\",\"name\":\"user_view\",\"definition\":\"SELECT id, name, email, age FROM users\",\"operation\":\"alter\"}")
V_SUCCESS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))")
if [ "$V_SUCCESS" = "True" ]; then
  log_pass ""
else
  log_fail "Failed: $RES"
fi

# ============================================================
# 7. 存储过程 CRUD
# ============================================================
log_test "创建存储过程 get_user_count"
RES=$(curl -s -X POST "$BASE_URL/objects/routine" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"sprint3_test\",\"name\":\"get_user_count\",\"type\":\"PROCEDURE\",\"body\":\"BEGIN\\n  SELECT COUNT(*) as cnt FROM users;\\nEND\",\"params\":[],\"operation\":\"create\"}")
R_SUCCESS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))")
if [ "$R_SUCCESS" = "True" ]; then
  log_pass ""
else
  log_fail "Failed: $RES"
fi

log_test "获取存储过程定义"
RES=$(curl -s "$BASE_URL/objects/PROCEDURE/get_user_count/code?connectionId=$CONN_ID&database=sprint3_test")
CODE=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('code','')))")
if [ "$CODE" -gt "10" ]; then
  log_pass "code_len=$CODE"
else
  log_fail "Failed: $RES"
fi

# ============================================================
# 8. 函数 CRUD
# ============================================================
log_test "创建函数 add_numbers"
RES=$(curl -s -X POST "$BASE_URL/objects/routine" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"sprint3_test\",\"name\":\"add_numbers\",\"type\":\"FUNCTION\",\"body\":\"BEGIN\\n  RETURN a + b;\\nEND\",\"params\":[{\"name\":\"a\",\"dataType\":\"INT\",\"direction\":\"IN\"},{\"name\":\"b\",\"dataType\":\"INT\",\"direction\":\"IN\"}],\"returns\":\"INT\",\"options\":{\"deterministic\":true},\"operation\":\"create\"}")
F_SUCCESS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))")
if [ "$F_SUCCESS" = "True" ]; then
  log_pass ""
else
  log_fail "Failed: $RES"
fi

log_test "调用函数 add_numbers(3, 5)"
RES=$(curl -s -X POST "$BASE_URL/queries/execute" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"query\":\"SELECT sprint3_test.add_numbers(3, 5) as result\"}")
RESULT=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); rows=d.get('data',{}).get('rows',[]); print(rows[0].get('result','N/A') if rows else 'N/A')")
if [ "$RESULT" = "8" ]; then
  log_pass "result=$RESULT"
else
  log_fail "Expected 8, got $RESULT"
fi

# ============================================================
# 9. 触发器 CRUD
# ============================================================
log_test "创建日志表 audit_log"
RES=$(curl -s -X POST "$BASE_URL/ddl/execute" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"sprint3_test\",\"sql\":\"CREATE TABLE audit_log (id INT AUTO_INCREMENT PRIMARY KEY, action VARCHAR(50), table_name VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)\"}")
if echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('success',True) else 1)" 2>/dev/null; then
  log_pass ""
else
  log_fail "Failed: $RES"
fi

log_test "创建触发器 users_insert_trigger"
RES=$(curl -s -X POST "$BASE_URL/objects/trigger" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"sprint3_test\",\"name\":\"users_insert_trigger\",\"timing\":\"AFTER\",\"event\":\"INSERT\",\"table\":\"users\",\"body\":\"BEGIN\\n  INSERT INTO audit_log (action, table_name) VALUES ('INSERT', 'users');\\nEND\",\"operation\":\"create\"}")
T_SUCCESS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))")
if [ "$T_SUCCESS" = "True" ]; then
  log_pass ""
else
  log_fail "Failed: $RES"
fi

log_test "获取触发器定义"
RES=$(curl -s "$BASE_URL/objects/TRIGGER/users_insert_trigger/code?connectionId=$CONN_ID&database=sprint3_test")
CODE=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('code','')))")
if [ "$CODE" -gt "10" ]; then
  log_pass "code_len=$CODE"
else
  log_fail "Failed: $RES"
fi

log_test "验证触发器生效 (插入数据后audit_log有记录)"
RES=$(curl -s -X POST "$BASE_URL/queries/execute" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"query\":\"INSERT INTO sprint3_test.users (name, email, age) VALUES ('David', 'david@test.com', 28)\"}")
RES2=$(curl -s -X POST "$BASE_URL/queries/execute" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"query\":\"SELECT COUNT(*) as cnt FROM sprint3_test.audit_log\"}")
CNT=$(echo "$RES2" | python3 -c "import sys,json; d=json.load(sys.stdin); rows=d.get('data',{}).get('rows',[]); print(rows[0].get('cnt',0) if rows else 0)")
if [ "$CNT" -ge "1" ]; then
  log_pass "audit_log_count=$CNT"
else
  log_fail "Expected >= 1, got $CNT"
fi

# ============================================================
# 10. 删除对象
# ============================================================
log_test "删除触发器"
RES=$(curl -s -X DELETE "$BASE_URL/objects/TRIGGER/users_insert_trigger" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"sprint3_test\"}")
D_SUCCESS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))")
if [ "$D_SUCCESS" = "True" ]; then
  log_pass ""
else
  log_fail "Failed: $RES"
fi

log_test "删除函数"
RES=$(curl -s -X DELETE "$BASE_URL/objects/FUNCTION/add_numbers" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"sprint3_test\"}")
D_SUCCESS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))")
if [ "$D_SUCCESS" = "True" ]; then
  log_pass ""
else
  log_fail "Failed: $RES"
fi

log_test "删除存储过程"
RES=$(curl -s -X DELETE "$BASE_URL/objects/PROCEDURE/get_user_count" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"sprint3_test\"}")
D_SUCCESS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))")
if [ "$D_SUCCESS" = "True" ]; then
  log_pass ""
else
  log_fail "Failed: $RES"
fi

log_test "删除视图"
RES=$(curl -s -X DELETE "$BASE_URL/objects/VIEW/user_view" \
  -H 'Content-Type: application/json' \
  -d "{\"connectionId\":\"$CONN_ID\",\"database\":\"sprint3_test\"}")
D_SUCCESS=$(echo "$RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))")
if [ "$D_SUCCESS" = "True" ]; then
  log_pass ""
else
  log_fail "Failed: $RES"
fi

# ============================================================
# 11. 清理
# ============================================================
log_test "清理测试数据库"
python3 -c "
import urllib.request, json
data = json.dumps({'connectionId':'$CONN_ID','database':'mysql','sql':'DROP DATABASE IF EXISTS sprint3_test'}).encode()
req = urllib.request.Request('$BASE_URL/ddl/execute', data=data, headers={'Content-Type':'application/json'}, method='POST')
res = json.loads(urllib.request.urlopen(req).read())
print('OK' if res.get('success',True) else json.dumps(res))
" | grep -q OK && log_pass "" || log_fail ""

# ============================================================
# 结果汇总
# ============================================================
echo ""
echo "============================================================"
echo "  Sprint 3 E2E 验证结果"
echo "============================================================"
echo -e "  总计: $TOTAL | ${GREEN}通过: $PASS${NC} | ${RED}失败: $FAIL${NC}"
echo "============================================================"
