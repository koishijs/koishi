---
sidebarDepth: 2
---

# 配置服务器

## 使用 nginx

下面给出一段 nginx 配置作为参考：

```
server {
  # server_name, port, ssl 等设置

  location / {
    # 这里的 8080 对应 Koishi 实例的端口
    proxy_pass http://127.0.0.1:8080/;
    proxy_redirect off;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $http_host;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
  }
}
```
