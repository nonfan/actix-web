# 中间件

## 什么是 Middleware（中间件）:question:

在 Actix Web 中，中间件是你可以插入到 请求(Request) - 处理(Handler) - 响应(Response) 流程之间的逻辑，用于：

- 在请求被处理前做些事情（预处理）
- 在响应返回客户端前做些事情（后处理）
- 控制请求是否继续（比如直接返回响应）
- 添加日志、认证、限流、默认 header 等功能

**中间件的主要作用:**

1. 预处理请求（Pre-process）：
   比如打印请求路径、验证 Token、读取 Session 等。

2. 后处理响应（Post-process）：
   比如添加日志信息、修改响应 header、处理错误等。

3. 修改应用状态：
   比如读取共享状态、添加全局配置。

4. 调用外部服务：
   比如连接 Redis、数据库、远程 API 等。

## 中间件的构建机制

中间件本质上是一个实现了 `Transform` 和 `Service` Trait 的结构体：

:one: **Transform Trait（构建阶段）**

当 App 启动时，会用 `Transform` 创建中间件的具体实例。

```rust
impl<S, B> Transform<S, ServiceRequest> for MyMiddleware {}
```

:two: **Service Trait（调用阶段）**

当有请求时，中间件会处理请求，然后决定是否继续传递请求。

```rust
impl<S, B> Service<ServiceRequest> for MyMiddleware<S> {}
```

## Actix 内置中间件

### Logger 中间件

通常将 Logger 中间件注册为应用程序的第一个中间件。必须为每个应用程序注册日志记录中间件。

创建指定格式的 Logger 中间件。默认 Logger 可以使用 default 方法创建，它使用默认格式：

```text
%a %t "%r" %s %b "%{Referer}i" "%{User-Agent}i" %T
```

```rust
use actix_web::middleware::Logger;
use env_logger::Env;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    use actix_web::{App, HttpServer};

    env_logger::init_from_env(Env::default().default_filter_or("info"));

    HttpServer::new(|| {
        App::new()
        .wrap(Logger::default())
        .wrap(Logger::new("%a %{User-Agent}i")) // 修改默认格式
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

**以下是默认日志记录格式的示例:**

```text
INFO:actix_web::middleware::logger: 127.0.0.1:59934 [02/Dec/2017:00:21:43 -0800] "GET / HTTP/1.1" 302 0 "-" "curl/7.54.0" 0.000397
INFO:actix_web::middleware::logger: 127.0.0.1:59947 [02/Dec/2017:00:22:40 -0800] "GET /index.html HTTP/1.1" 200 0 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:57.0) Gecko/20100101 Firefox/57.0" 0.000646
```

**格式**

| 标记        | 含义                                    | 示例                               |
|-----------|---------------------------------------|----------------------------------|
| `%%`      | 输出一个 `%` 字符                           | `%`                              |
| `%a`      | 客户端的 IP 地址（如果你在用反向代理，则是代理的 IP）        | `127.0.0.1`                      |
| `%t`      | 处理请求开始的时间                             | `[20/May/2025:10:00:00 +0800]`   |
| `%P`      | 处理请求的进程 ID（主要在多进程服务器中才有意义）            | `12345`                          |
| `%r`      | 请求的第一行内容，即：`METHOD PATH HTTP/VERSION` | `GET /index.html HTTP/1.1`       |
| `%s`      | 响应的 HTTP 状态码                          | `200`                            |
| `%b`      | 响应大小（单位：字节），包括响应头                     | `512`                            |
| `%T`      | 处理请求所花时间（单位：秒，浮点型，保留6位）               | `0.000123`                       |
| `%D`      | 处理请求所花时间（单位：毫秒）                       | `1`                              |
| `%{FOO}i` | 请求头中的某个字段 `FOO`（i = **input**）        | `%{User-Agent}i` → `curl/7.54.0` |
| `%{FOO}o` | 响应头中的某个字段 `FOO`（o = **output**）       | `%{Content-Type}o` → `text/html` |
| `%{FOO}e` | 系统环境变量中的某个变量 `FOO`（e = **env**）       | `%{PATH}e`                       |

```rs
Logger::new("%a %t \"%r\" %s %b \"%{Referer}i\" \"%{User-Agent}i\" %T")
```

### DefaultHeaders

要设置默认响应标头，可以使用 `DefaultHeaders` 中间件。如果响应标头已包含指定的标头， 则 `DefaultHeaders` 中间件不会设置标头。

```rs
App::new()
    .wrap(middleware::DefaultHeaders::new().add(("X-Version", "0.2")))
```

### SessionMiddleware

Actix Web 为会话管理提供了一个通用的解决方案。`actix-session` 中间件可以使用多种后端类型来存储会话数据。

使用 cookie 存储 session 数据（< 4000 字节，否则会生成内部服务器错误）：

```rs
use actix_session::{Session, SessionMiddleware, storage::CookieSessionStore};

App::new()
    .wrap(SessionMiddleware::builder(
        CookieSessionStore::default(),
        Key::from(&[0; 64]) // 密钥
    ).cookie_secure(false).build())
```

并使用 Session 提取器访问：

```rust
async fn index(session: Session) -> Result<HttpResponse, Error> {
    let count = session.get::<i32>("counter")?.unwrap_or(0);
    session.insert("counter", count + 1)?;
    Ok(HttpResponse::Ok().body(format!("Count: {}", count)))
}
```

### ErrorHandlers

`ErrorHandlers` 中间件允许我们为响应提供自定义处理程序。

你可以使用 `ErrorHandlers::handler()` 方法为特定状态代码注册自定义错误处理程序。您可以修改现有响应或创建全新的响应。错误处理程序可以立即返回响应，也可以返回解析为响应的
future。

```rs
fn my_error<B>(mut res: ServiceResponse<B>) -> Result<ErrorHandlerResponse<B>> {
    res.response_mut().headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("Error"),
    );
    Ok(ErrorHandlerResponse::Response(res.map_into_left_body()))
}

App::new()
    .wrap(ErrorHandlers::new().handler(StatusCode::INTERNAL_SERVER_ERROR, my_error))
```

## 中间件执行顺序

```rs
App::new()
    .wrap(M1)
    .wrap(M2)
```

```text
M2（请求） -> M1（请求） -> 处理器 -> M1（响应） -> M2（响应）
```

**因此，最后注册的中间件最先执行请求逻辑，最后执行响应逻辑。**
