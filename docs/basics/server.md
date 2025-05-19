# HTTP 服务器

在 Actix Web 中，`HttpServer` 类型负责处理 HTTP 请求。

## 创建和启动服务器

`HttpServer` 需要一个“应用工厂”（application factory），也就是返回 `App` 实例的闭包。这个闭包必须满足 Rust 中的
`Send + Sync` 要求（关于多线程的具体说明见后文）。

要启动服务器，你需要先绑定一个网络地址，比如：

```bash
.bind(("127.0.0.1", 8080))
# 或者
.bind("0.0.0.0:8080")
```

如果这个端口已经被其他程序占用，绑定就会失败。

绑定成功后，调用 `.run()` 方法启动服务器。它会返回一个 `Server` 实例。你需要 `.await` 它，才能真正开始处理请求。服务器会一直运行，直到收到关闭信号（比如按下
Ctrl+C，可以查看更详细的关闭机制说明）。

```rust
use actix_web::{web, App, HttpResponse, HttpServer};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| App::new().route("/", web::get().to(HttpResponse::Ok)))
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

## 多线程处理

`HttpServer` 会自动启动多个线程（叫做“worker”工作线程）来处理请求。默认启动的线程数是你电脑的 CPU 核心数。你也可以手动设置：

```rs
HttpServer::new(|| App::new().route("/", web::get().to(HttpResponse::Ok)))
    .workers(4); // 启动 4 个线程
```

每个线程都会拥有自己独立的 `App` 实例，它们之间不共享状态，因此你不必担心线程之间的数据冲突。

如果你希望多个线程之间共享某些数据，可以使用 `Arc` 或 `web::Data` 包装你的状态，但要注意锁的性能问题（比如用 `RwLock` 替代
`Mutex` 可以提升性能）。

**不要阻塞线程:exclamation:**

如果你在 handler 中使用了 `std::thread::sleep()` 这样的阻塞操作，会导致当前线程卡住，无法继续处理其他请求：

```rust
fn my_handler() -> impl Responder {
    std::thread::sleep(Duration::from_secs(5)); // ❌ 会卡住线程
    "response"
}
```

正确的做法是使用异步操作：

```rust
async fn my_handler() -> impl Responder {
    tokio::time::sleep(Duration::from_secs(5)).await; // ✅ 正确写法
    "response"
}
```

这个原则也适用于请求提取器（extractor）：如果 extractor 阻塞了当前线程，也会拖慢整个服务器。

## HTTPS 支持（TLS）

Actix Web 提供了两种开箱即用的方式来支持 HTTPS（也就是 TLS 加密）：

- 使用 `rustls`
- 使用 `openssl`(推荐)

### OpenSSL

> 适合了解 openssl 的人，兼容性好

:one: 在项目的 `Cargo.toml` 中开启 `openssl` 功能：

```toml
[dependencies]
actix-web = { version = "4", features = ["openssl"] }
openssl = { version = "0.10" }
```

:two: 创建一个自签名证书和私钥（开发测试用）：

```bash
openssl req -x509 -newkey rsa:4096 -nodes -keyout key.pem -out cert.pem \
  -days 365 -subj "/CN=localhost"
```

:three: 在代码中加载证书和私钥：

```rust
use actix_web::{get, App, HttpRequest, HttpServer, Responder};
use openssl::ssl::{SslAcceptor, SslFiletype, SslMethod}; // [!code highlight]

#[get("/")]
async fn index(_req: HttpRequest) -> impl Responder {
    "欢迎访问 HTTPS 网站！"
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let mut builder = SslAcceptor::mozilla_intermediate(SslMethod::tls()).unwrap(); // [!code highlight:3]
    builder.set_private_key_file("key.pem", SslFiletype::PEM).unwrap();
    builder.set_certificate_chain_file("cert.pem").unwrap();

    HttpServer::new(|| App::new().service(index))
    .bind_openssl("127.0.0.1:8080", builder)?
    .run()
    .await
}
```

### rustls

> 纯 Rust 实现，更加轻量安全

:one: 同理，在项目的 `Cargo.toml` 中开启 `rustls` 功能，并添加 rustls 相关依赖：

```toml
[dependencies]
actix-web = { version = "4", features = ["rustls"] }
rustls = "0.21"
rustls-pemfile = "1.0"
```

:two: 准备你的证书文件和私钥文件（PEM 格式）。

:three: 加载证书的代码如下：

```rust
use std::fs::File;
use std::io::BufReader;

use actix_web::{web, App, HttpServer, Responder};
use rustls::{ServerConfig, Certificate, PrivateKey};
use rustls_pemfile::{certs, rsa_private_keys};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // 读取证书和私钥
    let cert_file = &mut BufReader::new(File::open("cert.pem")?);
    let key_file = &mut BufReader::new(File::open("key.pem")?);

    let cert_chain = certs(cert_file)
    .unwrap()
    .into_iter()
    .map(Certificate)
    .collect();

    let mut keys = rsa_private_keys(key_file).unwrap();
    let key = PrivateKey(keys.remove(0));

    let config = ServerConfig::builder()
    .with_safe_defaults()
    .with_no_client_auth()
    .with_single_cert(cert_chain, key)
    .unwrap();

    HttpServer::new(|| {
        App::new().route("/", web::get().to(|| async { "Hello from rustls!" }))
    })
    .bind_rustls("127.0.0.1:8443", config)?
    .run()
    .await
}
```

## Keep-Alive（保持连接）

Actix 默认会保持连接开启，等待下一个请求。你可以通过设置 `.keep_alive()` 来控制保持连接的行为：

```rs
use actix_web::{http::KeepAlive, HttpServer};
use std::time::Duration;

HttpServer::new(app)
    .keep_alive(Duration::from_secs(75)); // 保持连接 75 秒

HttpServer::new(app)
    .keep_alive(KeepAlive::Os); // 使用系统默认

HttpServer::new(app)
    .keep_alive(None); // 禁用 keep-alive
```

如果你想手动关闭某个响应的连接：

```rs
use actix_web::{http, HttpRequest, HttpResponse};

async fn index(_req: HttpRequest) -> HttpResponse {
    let mut resp = HttpResponse::Ok()
        .force_close() // 强制关闭连接
        .finish();

    // 也可以这样设置响应头来关闭连接
    resp.head_mut()
        .set_connection_type(http::ConnectionType::Close);

    resp
}
```

HTTP/1.0 默认是关闭连接的，HTTP/1.1 和 HTTP/2 默认是开启 keep-alive 的。

> [!TIP] 提升性能
> 对于服务器来说，频繁创建/销毁连接会消耗 CPU、内存和网络资源。开启 Keep-Alive 后，连接被复用 ➜ 更少的连接切换 ➜ 更高的吞吐量。

## 优雅关闭（Graceful Shutdown）

服务器在接收到终止信号时，会等待一段时间让正在处理的请求完成，然后才关闭线程。

默认的关闭超时时间是 30 秒。可以用 `.shutdown_timeout()` 修改：

```rs
HttpServer::new(app)
    .shutdown_timeout(10); // 设置为 10 秒
```

支持的操作系统信号有：

* `CTRL-C`：所有系统支持
* Unix 系统支持更多：
    - `SIGINT`：强制关闭
    - `SIGTERM`：优雅关闭
    - `SIGQUIT`：强制关闭

如果你不希望 `HttpServer` 自动处理这些信号，可以调用 `.disable_signals()`。

我们来看一个完整例子，展示如何手动监听信号，然后优雅关闭 Actix Web 服务：

```rust
use actix_web::{web, App, HttpServer, HttpResponse};
use tokio::signal;
use std::io;

#[actix_web::main]
async fn main() -> io::Result<()> {
    // 创建一个 HttpServer 实例，但不自动处理系统信号
    let server = HttpServer::new(|| {
        App::new().route("/", web::get().to(|| HttpResponse::Ok().body("Hello!")))
    })
    .bind("127.0.0.1:8080")?
    .disable_signals() // <- 禁用默认信号处理 // [!code highlight]
    .run();

    // 启动一个任务监听 Ctrl+C 或 SIGTERM 等系统信号
    let server_handle = server.handle();
    let signal_handler = tokio::spawn(async move {
        // 等待 Ctrl+C 或 SIGTERM（tokio::signal 支持多平台）
        signal::ctrl_c().await.expect("Failed to listen for Ctrl+C");
        println!("收到 Ctrl+C 信号，准备优雅关闭服务...");
        server_handle.stop(true).await;
    });

    // 启动 HTTP 服务（阻塞直到 shutdown）
    tokio::select! {
        _ = server => {},
        _ = signal_handler => {},
    }

    println!("服务已关闭");
    Ok(())
}
```