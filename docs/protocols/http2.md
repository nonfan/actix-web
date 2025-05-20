# HTTP/2

> [!TIP] 未来版本
> Actix Web 默认会自动尝试升级连接到 HTTP/2（如果客户端和服务端都支持）。这意味着你写的代码通常不需要特别处理 HTTP/2，框架会帮你做这件事。


## HTTPS(TLS) 支持

为了启用 HTTPS，你需要给服务器配置证书和私钥。Actix Web 支持使用 `rustls` 或 `openssl` 两种库来做 TLS 绑定。

- 如果启用了 `rustls` 功能，使用 `bind_rustls()` 或对应版本的 bind_rustls_0_23() 方法 
- 如果启用了 `openssl` 功能，使用 `bind_openssl()` 方法