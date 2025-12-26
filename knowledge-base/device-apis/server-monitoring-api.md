# 服务器监控API

## 系统信息获取

### GET /api/system/info

获取服务器基本信息

**URL:** `http://monitor-server:8080/api/system/info`

**Method:** GET

**Description:** 获取服务器的基本系统信息，包括CPU、内存、磁盘等信息

**Parameters:**

| 参数名 | 类型 | 是否必需 | 描述 |
|--------|------|----------|------|
| detail | boolean | 否 | 是否返回详细信息，默认false |

**Request Example:**
```bash
curl -X GET "http://monitor-server:8080/api/system/info?detail=true"
```

**Response Example:**
```json
{
  "status": "success",
  "data": {
    "hostname": "server-001",
    "uptime": 3600,
    "cpu": {
      "cores": 4,
      "usage": 65.5,
      "load_avg": [1.2, 1.5, 1.8]
    },
    "memory": {
      "total": 8589934592,
      "used": 5368709120,
      "free": 3221225472,
      "usage_percent": 62.5
    },
    "disk": {
      "total": 107374182400,
      "used": 64424509440,
      "free": 42949672960,
      "usage_percent": 60.0
    }
  }
}
```

## 进程管理

### GET /api/process/list

获取进程列表

**URL:** `http://monitor-server:8080/api/process/list`

**Method:** GET

**Description:** 获取当前运行的进程列表，支持按CPU和内存使用率排序

**Parameters:**

| 参数名 | 类型 | 是否必需 | 描述 |
|--------|------|----------|------|
| sort | string | 否 | 排序方式：cpu, memory, name |
| limit | integer | 否 | 返回进程数量限制，默认50 |
| filter | string | 否 | 进程名称过滤条件 |

**Request Example:**
```bash
curl -X GET "http://monitor-server:8080/api/process/list?sort=cpu&limit=10"
```

**Response Example:**
```json
{
  "status": "success",
  "data": {
    "processes": [
      {
        "pid": 1234,
        "name": "nginx",
        "cpu_percent": 15.2,
        "memory_percent": 8.5,
        "status": "running",
        "start_time": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 156
  }
}
```

### POST /api/process/restart

重启指定进程

**URL:** `http://monitor-server:8080/api/process/restart`

**Method:** POST

**Description:** 重启指定的系统进程或服务

**Request Body:**
```json
{
  "service_name": "nginx",
  "force": false
}
```

**Parameters:**

| 参数名 | 类型 | 是否必需 | 描述 |
|--------|------|----------|------|
| service_name | string | 是 | 服务名称 |
| force | boolean | 否 | 是否强制重启，默认false |

**Response Example:**
```json
{
  "status": "success",
  "message": "Service nginx restarted successfully",
  "data": {
    "old_pid": 1234,
    "new_pid": 5678,
    "restart_time": "2024-01-15T11:00:00Z"
  }
}
```

## 日志管理

### GET /api/logs/tail

获取日志文件尾部内容

**URL:** `http://monitor-server:8080/api/logs/tail`

**Method:** GET

**Description:** 获取指定日志文件的最新内容

**Parameters:**

| 参数名 | 类型 | 是否必需 | 描述 |
|--------|------|----------|------|
| file_path | string | 是 | 日志文件路径 |
| lines | integer | 否 | 获取行数，默认100 |
| follow | boolean | 否 | 是否持续监控，默认false |

**Request Example:**
```bash
curl -X GET "http://monitor-server:8080/api/logs/tail?file_path=/var/log/nginx/access.log&lines=50"
```

**Response Example:**
```json
{
  "status": "success",
  "data": {
    "file_path": "/var/log/nginx/access.log",
    "lines": [
      "192.168.1.100 - - [15/Jan/2024:11:00:01 +0000] \"GET / HTTP/1.1\" 200 612",
      "192.168.1.101 - - [15/Jan/2024:11:00:02 +0000] \"GET /api HTTP/1.1\" 200 1024"
    ],
    "total_lines": 50,
    "file_size": 1048576
  }
}
```