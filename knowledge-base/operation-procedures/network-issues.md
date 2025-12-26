# 网络连接异常处置

<!-- metadata
{
  "category": "network",
  "keywords": ["网络", "连接超时", "丢包", "延迟"],
  "description": "网络连接异常问题的诊断和处置方法"
}
-->

## 问题现象

网络连接出现异常，常见表现：
- 连接超时或拒绝
- 网络延迟过高
- 丢包率增加
- 间歇性网络中断

## 处置步骤

### 1. 基础网络检查

执行基本网络连通性测试：

```bash
# 检查网络接口状态
ip addr show
ifconfig

# 测试本地网络
ping -c 4 127.0.0.1
ping -c 4 网关IP

# 测试外网连接
ping -c 4 8.8.8.8
nslookup www.google.com
```

### 2. 检查网络配置

验证网络配置是否正确：

```bash
# 查看路由表
ip route show
route -n

# 检查DNS配置
cat /etc/resolv.conf
systemd-resolve --status

# 查看网络服务状态
systemctl status NetworkManager
systemctl status networking
```

### 3. 端口和服务检查

检查相关端口和服务：

```bash
# 检查端口监听状态
netstat -tlnp
ss -tlnp

# 测试特定端口连接
telnet 目标IP 端口
nc -zv 目标IP 端口

# 检查防火墙状态
iptables -L -n
ufw status
```

### 4. 网络性能分析

分析网络性能指标：

```bash
# 网络延迟测试
ping -c 10 目标IP
mtr 目标IP

# 带宽测试
iperf3 -c 服务器IP
speedtest-cli

# 网络流量监控
iftop
nethogs
```

### 5. 抓包分析

使用抓包工具分析网络流量：

```bash
# 抓取网络包
tcpdump -i eth0 -w capture.pcap
tcpdump -i any host 目标IP

# 实时查看网络包
tcpdump -i eth0 -n
wireshark（图形界面）
```

### 6. 系统级网络优化

调整系统网络参数：

```bash
# 增加网络缓冲区
echo 'net.core.rmem_max = 16777216' >> /etc/sysctl.conf
echo 'net.core.wmem_max = 16777216' >> /etc/sysctl.conf

# 调整TCP参数
echo 'net.ipv4.tcp_window_scaling = 1' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_timestamps = 1' >> /etc/sysctl.conf

# 应用配置
sysctl -p
```

## 常见问题及解决方法

### DNS解析问题

1. **DNS服务器不可达**
   ```bash
   # 更换DNS服务器
   echo "nameserver 8.8.8.8" > /etc/resolv.conf
   echo "nameserver 114.114.114.114" >> /etc/resolv.conf
   ```

2. **DNS缓存问题**
   ```bash
   # 清理DNS缓存
   systemd-resolve --flush-caches
   service nscd restart
   ```

### 防火墙问题

1. **检查防火墙规则**
   ```bash
   iptables -L -n --line-numbers
   ufw status numbered
   ```

2. **临时关闭防火墙测试**
   ```bash
   systemctl stop iptables
   ufw disable
   ```

### 网卡问题

1. **重启网络接口**
   ```bash
   ifdown eth0 && ifup eth0
   ip link set eth0 down && ip link set eth0 up
   ```

2. **检查网卡驱动**
   ```bash
   ethtool eth0
   lspci | grep -i ethernet
   ```

### 路由问题

1. **检查默认路由**
   ```bash
   ip route show default
   ```

2. **添加临时路由**
   ```bash
   ip route add default via 网关IP
   ```

## 应用层网络问题

### Web服务连接问题

1. **检查Web服务状态**
   ```bash
   systemctl status nginx
   systemctl status apache2
   curl -I http://localhost
   ```

2. **查看访问日志**
   ```bash
   tail -f /var/log/nginx/access.log
   tail -f /var/log/apache2/access.log
   ```

### 数据库连接问题

1. **检查数据库监听**
   ```bash
   netstat -tlnp | grep 3306
   mysql -h localhost -u root -p
   ```

2. **测试连接池**
   ```bash
   # 检查连接数
   mysqladmin -u root -p processlist
   ```

## 监控和预防

### 建立网络监控

1. **实时监控脚本**
   ```bash
   #!/bin/bash
   while true; do
       ping -c 1 8.8.8.8 > /dev/null
       if [ $? -ne 0 ]; then
           echo "$(date): Network issue detected"
       fi
       sleep 30
   done
   ```

2. **网络性能基线**
   - 记录正常情况下的网络指标
   - 设置告警阈值
   - 定期进行网络性能测试

### 预防措施

1. **冗余网络设计**
   - 多网卡绑定
   - 多路由配置
   - 备用DNS服务器

2. **定期维护**
   - 更新网络驱动
   - 检查网线连接
   - 清理网络配置

## 注意事项

1. **影响评估**：网络操作可能影响所有服务
2. **操作顺序**：从影响最小的操作开始
3. **回滚准备**：准备快速回滚方案
4. **文档记录**：详细记录网络配置变更

## 常用工具总结

```bash
# 连通性测试
ping, traceroute, mtr, telnet, nc

# 配置查看
ip, ifconfig, route, netstat, ss

# 性能分析
iperf3, speedtest-cli, iftop, nethogs

# 抓包分析
tcpdump, wireshark, tshark

# 系统调优
sysctl, ethtool
```