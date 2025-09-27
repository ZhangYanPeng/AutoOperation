# 数据库管理API

## 数据库状态监控

### GET /api/database/status

获取数据库服务状态

**URL:** `http://db-manager:8080/api/database/status`

**Method:** GET

**Description:** 获取数据库服务的运行状态和基本性能指标

**Parameters:**

| 参数名 | 类型 | 是否必需 | 描述 |
|--------|------|----------|------|
| detailed | boolean | 否 | 是否返回详细状态信息 |

**Request Example:**
```bash
curl -X GET "http://db-manager:8080/api/database/status?detailed=true"
```

**Response Example:**
```json
{
  "status": "success",
  "data": {
    "service_status": "running",
    "uptime": 345600,
    "version": "MySQL 8.0.32",
    "connections": {
      "current": 25,
      "max": 151,
      "usage_percent": 16.6
    },
    "performance": {
      "queries_per_second": 45.2,
      "slow_queries": 3,
      "buffer_pool_usage": 78.5,
      "innodb_buffer_pool_size": 1073741824
    },
    "replication": {
      "master_status": "enabled",
      "slave_lag": 0,
      "slaves_connected": 2
    }
  }
}
```

## 连接管理

### GET /api/database/connections

获取当前数据库连接信息

**URL:** `http://db-manager:8080/api/database/connections`

**Method:** GET

**Parameters:**

| 参数名 | 类型 | 是否必需 | 描述 |
|--------|------|----------|------|
| filter | string | 否 | 过滤条件：active, idle, locked |
| limit | integer | 否 | 返回连接数量限制 |

**Response Example:**
```json
{
  "status": "success",
  "data": {
    "connections": [
      {
        "connection_id": 123,
        "user": "app_user",
        "host": "192.168.1.100:3306",
        "database": "production_db",
        "command": "Query",
        "time": 1.23,
        "state": "executing",
        "query": "SELECT * FROM users WHERE active = 1"
      }
    ],
    "total": 25
  }
}
```

### DELETE /api/database/connections/{connection_id}

终止指定的数据库连接

**URL:** `http://db-manager:8080/api/database/connections/{connection_id}`

**Method:** DELETE

**Parameters:**

| 参数名 | 类型 | 是否必需 | 描述 |
|--------|------|----------|------|
| connection_id | integer | 是 | 连接ID |

**Response Example:**
```json
{
  "status": "success",
  "message": "Connection 123 terminated successfully"
}
```

## 备份管理

### POST /api/database/backup

创建数据库备份

**URL:** `http://db-manager:8080/api/database/backup`

**Method:** POST

**Request Body:**
```json
{
  "databases": ["production_db", "user_db"],
  "backup_type": "full",
  "compression": true,
  "location": "/backup/mysql/"
}
```

**Parameters:**

| 参数名 | 类型 | 是否必需 | 描述 |
|--------|------|----------|------|
| databases | array | 是 | 要备份的数据库列表 |
| backup_type | string | 否 | 备份类型：full, incremental |
| compression | boolean | 否 | 是否压缩备份文件 |
| location | string | 否 | 备份文件存储位置 |

**Response Example:**
```json
{
  "status": "success",
  "message": "Backup job started successfully",
  "data": {
    "job_id": "backup-20240115-001",
    "estimated_size": "2.5GB",
    "estimated_duration": "15 minutes",
    "backup_file": "/backup/mysql/production_backup_20240115_110000.sql.gz"
  }
}
```

### GET /api/database/backup/jobs

获取备份任务列表

**URL:** `http://db-manager:8080/api/database/backup/jobs`

**Method:** GET

**Parameters:**

| 参数名 | 类型 | 是否必需 | 描述 |
|--------|------|----------|------|
| status | string | 否 | 任务状态过滤：running, completed, failed |
| limit | integer | 否 | 返回任务数量限制 |

**Response Example:**
```json
{
  "status": "success",
  "data": {
    "jobs": [
      {
        "job_id": "backup-20240115-001",
        "status": "completed",
        "start_time": "2024-01-15T11:00:00Z",
        "end_time": "2024-01-15T11:12:00Z",
        "databases": ["production_db"],
        "backup_size": "2.1GB",
        "backup_file": "/backup/mysql/production_backup_20240115_110000.sql.gz"
      }
    ],
    "total": 1
  }
}
```

## 性能优化

### GET /api/database/performance/slow-queries

获取慢查询日志

**URL:** `http://db-manager:8080/api/database/performance/slow-queries`

**Method:** GET

**Parameters:**

| 参数名 | 类型 | 是否必需 | 描述 |
|--------|------|----------|------|
| time_range | string | 否 | 时间范围：1h, 6h, 24h, 7d |
| limit | integer | 否 | 返回查询数量限制 |
| min_duration | float | 否 | 最小执行时间（秒） |

**Response Example:**
```json
{
  "status": "success",
  "data": {
    "slow_queries": [
      {
        "query_time": 5.234,
        "lock_time": 0.001,
        "rows_sent": 1000,
        "rows_examined": 50000,
        "timestamp": "2024-01-15T11:00:00Z",
        "user": "app_user",
        "host": "192.168.1.100",
        "sql_text": "SELECT * FROM large_table WHERE complex_condition = 'value'"
      }
    ],
    "total": 15,
    "summary": {
      "average_query_time": 3.2,
      "max_query_time": 12.5,
      "total_slow_queries": 15
    }
  }
}
```

### POST /api/database/performance/optimize

执行数据库性能优化

**URL:** `http://db-manager:8080/api/database/performance/optimize`

**Method:** POST

**Request Body:**
```json
{
  "operations": ["analyze_tables", "optimize_tables", "update_statistics"],
  "databases": ["production_db"],
  "schedule": "immediate"
}
```

**Response Example:**
```json
{
  "status": "success",
  "message": "Optimization job started",
  "data": {
    "job_id": "optimize-20240115-001",
    "operations": ["analyze_tables", "optimize_tables"],
    "estimated_duration": "30 minutes"
  }
}
```

## 用户权限管理

### GET /api/database/users

获取数据库用户列表

**URL:** `http://db-manager:8080/api/database/users`

**Method:** GET

**Response Example:**
```json
{
  "status": "success",
  "data": {
    "users": [
      {
        "username": "app_user",
        "host": "%",
        "privileges": ["SELECT", "INSERT", "UPDATE", "DELETE"],
        "databases": ["production_db", "staging_db"],
        "last_login": "2024-01-15T10:30:00Z",
        "account_locked": false
      }
    ],
    "total": 5
  }
}
```

### POST /api/database/users

创建新的数据库用户

**URL:** `http://db-manager:8080/api/database/users`

**Method:** POST

**Request Body:**
```json
{
  "username": "new_app_user",
  "password": "secure_password",
  "host": "192.168.1.%",
  "privileges": ["SELECT", "INSERT", "UPDATE"],
  "databases": ["app_db"]
}
```

**Response Example:**
```json
{
  "status": "success",
  "message": "User created successfully",
  "data": {
    "username": "new_app_user",
    "host": "192.168.1.%",
    "created_at": "2024-01-15T11:15:00Z"
  }
}
```