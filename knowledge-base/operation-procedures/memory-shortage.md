# 内存不足问题处置

<!-- metadata
{
  "category": "performance",
  "keywords": ["内存", "OOM", "内存泄漏", "swap"],
  "description": "服务器内存不足和OOM问题的处置方法"
}
-->

## 问题现象

系统出现内存不足问题，常见表现：
- 应用程序被OOM Killer终止
- 系统响应极其缓慢
- swap使用率很高
- 出现"Cannot allocate memory"错误

## 处置步骤

### 1. 检查内存使用情况

查看当前内存状态：

```bash
free -h
cat /proc/meminfo
vmstat 1 5
```

### 2. 识别内存占用进程

找出占用内存最多的进程：

```bash
ps aux --sort=-%mem | head -10
smem -rs uss
pmap -x <PID>
```

### 3. 检查OOM日志

查看系统日志中的OOM记录：

```bash
dmesg | grep -i "killed process"
journalctl -k | grep -i "out of memory"
grep -i "out of memory" /var/log/messages
```

### 4. 立即缓解措施

**紧急情况下的处理：**

1. **清理缓存**
   ```bash
   echo 3 > /proc/sys/vm/drop_caches
   ```

2. **重启高内存进程**
   - 识别可以重启的非关键进程
   - 有序重启，观察内存释放情况

3. **增加swap空间**（临时措施）
   ```bash
   fallocate -l 2G /swapfile
   chmod 600 /swapfile
   mkswap /swapfile
   swapon /swapfile
   ```

### 5. 分析内存泄漏

检查是否存在内存泄漏：

1. **使用valgrind检测**
   ```bash
   valgrind --tool=memcheck --leak-check=full program
   ```

2. **监控进程内存增长**
   ```bash
   while true; do ps -o pid,vsz,rss,comm -p <PID>; sleep 60; done
   ```

3. **分析应用日志**
   - 查找内存相关错误信息
   - 分析gc日志（Java应用）

### 6. 调整系统参数

优化内存管理参数：

```bash
# 调整swap使用策略
echo 10 > /proc/sys/vm/swappiness

# 调整OOM killer策略
echo 2 > /proc/sys/vm/overcommit_memory

# 设置内存回收阈值
echo 1024 > /proc/sys/vm/min_free_kbytes
```

## 预防措施

### 1. 监控告警

建立内存使用率监控：
- 设置内存使用率告警阈值（如85%）
- 监控swap使用情况
- 跟踪进程内存增长趋势

### 2. 容量规划

- 评估应用内存需求
- 预留足够的内存冗余
- 制定扩容策略

### 3. 应用优化

- 代码层面优化内存使用
- 设置合理的内存限制
- 实施内存池管理

## 不同类型应用的处理

### Java应用
```bash
# 调整JVM内存参数
-Xms2g -Xmx4g -XX:NewRatio=3
# 启用GC日志
-XX:+PrintGC -XX:+PrintGCDetails
```

### 数据库
- 调整缓冲池大小
- 优化查询性能
- 清理临时表和缓存

### Web服务器
- 调整进程/线程数量
- 优化缓存配置
- 限制连接数

## 注意事项

1. **避免盲目清理缓存**：可能影响系统性能
2. **谨慎使用swap**：过度依赖会严重影响性能
3. **分步骤操作**：每次只调整一个参数，观察效果
4. **备份配置**：修改前备份原有配置

## 相关命令

```bash
# 内存信息
free, vmstat, smem, pmap, /proc/meminfo

# 进程监控
ps, top, htop, pstree

# 系统调优
sysctl, echo > /proc/sys/vm/*

# 日志分析
dmesg, journalctl, grep
```