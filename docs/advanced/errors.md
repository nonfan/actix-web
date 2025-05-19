# 错误处理

## 基础错误处理机制

在 Actix Web 中，我们不直接使用标准库里的 `std::error::Error` 类型来处理 HTTP 错误响应。取而代之，Actix Web 提供了自己的专用错误类型和
trait：

- `actix_web::error::Error`
- `actix_web::error::ResponseError`

### 什么是 ResponseError:question:

`ResponseError` 是一个 trait，它定义了“当你的程序出错时，该如何生成一个 HTTP 响应”。

```rust
pub trait ResponseError {
    fn error_response(&self) -> HttpResponse<BoxBody>;
    fn status_code(&self) -> StatusCode;
}
```

如果一个错误类型实现了这个 trait，那么 Actix Web 就可以自动把它转成 HTTP 响应返回给客户端。

### 自动转换 Result 为 HTTP 响应

在请求处理函数中你可以这样写：

```rust
async fn index() -> Result<&'static str, MyError> {
    // ...
}
```

如果 MyError 实现了 `ResponseError`，Actix Web 会自动把它转换为 HTTP 响应，不需要你手动构造 `HttpResponse`。

**这个转换背后的关键实现是：**

```rust
impl<T: Responder, E: Into<Error>> Responder for Result<T, E> {}
```

也就是说，任何实现了 `Into<actix_web::Error>` 的错误类型，都可以放在 `Result<T, E>` 中，Actix Web 会自动处理。

### 默认行为

如果你返回一个标准错误（比如 `std::io::Error`），Actix Web 默认会返回一个 500 内部服务器错误（Internal Server Error）。

```rust
use std;
use actix_files::NamedFile;

fn index(_req: HttpRequest) -> io::Result<NamedFile> {
    Ok(NamedFile::open("static/index.html")?)
}
```

如果文件找不到，这个错误会自动变成 HTTP 500 错误响应。

## 常见标准错误

Actix Web 不只是支持你自定义的错误类型，它还内置支持一些标准库和常用库中的错误类型。也就是说，你不必手动为这些错误实现
ResponseError，它们已经默认可以被转换为 HTTP 响应。

你不需要为每个错误都手动写代码去转换。像这些错误：

- `std::io::Error`
- `serde_json::Error`
- `actix_multipart::MultipartError`
- `uuid::Error`

很多都已经实现了 ResponseError。你只要直接 `?` 抛出去就行，Actix Web 会自动转换成 HTTP 响应。

```rust
fn handler() -> Result<NamedFile, io::Error> {
    Ok(NamedFile::open("some-file.html")?)
}
```

## 自定义错误类型

在实际开发中，我们经常需要控制错误返回给用户的内容，比如表单验证失败、数据格式错误、请求超时等情况。这些错误都可以使用 Actix
Web 的 `ResponseError` trait 来自定义格式和状态码。

### 使用自定义结构体作为错误类型

我们定义一个错误结构体 MyError，并为它实现 ResponseError，这样它就可以自动转成 HTTP 响应返回给用户了。

```rust
use actix_web::{error, Result};
use derive_more::{Display, Error};

#[derive(Debug, Display, Error)]
#[display("my error: {name}")]
struct MyError {
    name: &'static str,
}

// 默认使用 500 错误响应
impl error::ResponseError for MyError {}

async fn index() -> Result<&'static str, MyError> {
    Err(MyError { name: "test" })
}
```

- `derive_more` 是一个用于自动生成 Display 和 Error trait 实现的简化库。

- `ResponseError` 默认会使用状态码 500 Internal Server Error 和错误消息作为响应体。

### 自定义返回内容和状态码

你也可以覆盖 ResponseError 的方法，自己定义状态码和响应内容：

```rust
use actix_web::{
    error,
    http::{header::ContentType, StatusCode},
    HttpResponse,
};
use derive_more::{Display, Error}; // 添加依赖 derive_more = "2.0.1" 确保Display Error生效

#[derive(Debug, Display, Error)]
enum MyError {
    #[display("internal error")]
    InternalError,

    #[display("bad request")]
    BadClientData,

    #[display("timeout")]
    Timeout,
}

impl error::ResponseError for MyError {
    fn error_response(&self) -> HttpResponse {
        HttpResponse::build(self.status_code())
        .insert_header(ContentType::html())
        .body(self.to_string())
    }

    fn status_code(&self) -> StatusCode {
        match self {
            MyError::InternalError => StatusCode::INTERNAL_SERVER_ERROR,
            MyError::BadClientData => StatusCode::BAD_REQUEST,
            MyError::Timeout => StatusCode::GATEWAY_TIMEOUT,
        }
    }
}
```

**当你返回不同的错误变体时，框架将根据你定义的逻辑：**

- `BadClientData` → 400 Bad Request
- `Timeout` → 504 Gateway Timeout
- `InternalError` → 500 Internal Server Error

## 错误辅助工具

有时候我们在处理结果时（例如读取文件、解析 JSON、调用第三方服务等），返回的错误类型并不符合 Actix Web 的要求。这时我们可以用
`map_err` 将这些错误快速转换成实现了 `ResponseError` 的错误。

假设我们有一个自定义错误类型 MyError，它本身没有实现 ResponseError，我们可以这样转换它：

```rust
use actix_web::{error, get, App, HttpServer, Result};

#[derive(Debug)]
struct MyError {
    name: &'static str,
}

#[get("/")]
async fn index() -> Result<String> {
    let result = Err(MyError { name: "test error" });

    // 将自定义错误转换为 actix_web 的 BadRequest 错误
    result.map_err(|err| error::ErrorBadRequest(err.name))
}
```

`map_err` 会在错误发生时被调用，将原始错误 MyError 转换成 `ErrorBadRequest(err.name)`, 而 `ErrorBadRequest` 是 Actix Web
提供的便捷方法，能自动设置 400 状态码。返回值类型变成了 `actix_web::Result<T>`，框架会自动处理并生成合适的 HTTP 响应。

**你还可以用这些常见的错误包装方法：**

| 错误构造函数                            | 状态码                       |
|-----------------------------------|---------------------------|
| `error::ErrorBadRequest`          | 400 Bad Request           |
| `error::ErrorUnauthorized`        | 401 Unauthorized          |
| `error::ErrorForbidden`           | 403 Forbidden             |
| `error::ErrorNotFound`            | 404 Not Found             |
| `error::ErrorInternalServerError` | 500 Internal Server Error |
| `error::ErrorServiceUnavailable`  | 503 Service Unavailable   |

## 错误日志与调试

在开发和部署 Web 服务时，**错误日志**和**调用栈** 是调试的重要手段。Actix Web 提供了日志中间件 Logger，配合 `env_logger`
和环境变量，你可以轻松记录请求和错误信息。

在你的 `Cargo.toml` 文件中添加如下依赖：

```toml
[dependencies]
actix-web = "4"
env_logger = "0.11.8"
log = "0.4"
derive_more = "2.0.1"
```

使用日志中间件 Logger:

```rust
use actix_web::{App, HttpServer, Result, error, get, middleware::Logger};
use derive_more::{Display, Error};
use log::info;

#[derive(Debug, Display, Error)]
#[display("my error: {name}")]
pub struct MyError {
    name: &'static str,
}

// 使用默认实现
impl error::ResponseError for MyError {}

#[get("/")]
async fn index() -> Result<&'static str, MyError> {
    let err = MyError { name: "test error" };
    info!("{}", err);
    Err(err)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    unsafe {
        std::env::set_var("RUST_LOG", "info");
        std::env::set_var("RUST_BACKTRACE", "1");
    }
    env_logger::init();

    HttpServer::new(|| {
        let logger = Logger::default();

        App::new()
        .wrap(logger)
        .service(index)
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

> [!WARNING] unsafe
> 在 Rust 1.77（2024年4月发布）之后，`std::env::set_var` 被标记为 unsafe 函数，需要用 unsafe {} 包裹起来才能调用。

## 推荐的错误处理实践

在 Actix Web 中构建应用时，错误不可避免。但不是所有错误都应该以同样的方式对待。一些错误应返回给用户（如
404、验证失败），另一些应记录到日志或报警（如数据库异常、系统崩溃等）。

### 错误分类

| 类型     | 说明                  | 是否返回给前端  |
|--------|---------------------|----------|
| 用户可见错误 | 输入错误、权限不足、找不到资源等    | ✅ 是      |
| 系统级错误  | 数据库连接失败、panic、bug 等 | ❌ 否（仅记录） |

### 设计错误类型

:one: 我们推荐统一定义一个 `AppError` 枚举，将所有错误封装起来，并区分展示方式。

:::code-group

```rust [纯手写实现]
use actix_web::{
    App, HttpResponse, HttpServer, Result, error, get, http::StatusCode,
};
use serde_json;

#[derive(Debug)]
pub enum AppError {
    BadRequest(String),
    NotFound(String),
    InternalError,
}

// 手动实现 Display
impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::BadRequest(msg) => write!(f, "Bad Request: {}", msg),
            AppError::NotFound(msg) => write!(f, "Not Found: {}", msg),
            AppError::InternalError => write!(f, "Internal Server Error"),
        }
    }
}
```

```rust [derive_more 实现]
use derive_more::Display;

#[derive(Debug, Display)]
pub enum AppError {
    #[display("Bad Request: {_0}")]
    BadRequest(String),
    #[display("Not Found: {_0}")]
    NotFound(String),
    #[display("Internal Server Error")]
    InternalError,
}
```

:::

:two: 为错误类型实现 `ResponseError` 响应类型。

```rust
// 手动实现 std::error::Error
impl std::error::Error for AppError {}

// 实现 actix-web 的 ResponseError trait
impl error::ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::InternalError => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        HttpResponse::build(self.status_code()).json(serde_json::json!({
            "error": self.to_string()
        }))
    }
}
```

:three: 实际使用中如何区分

```rust
#[get("/user/{id}")]
async fn get_user(id: actix_web::web::Path<i32>) -> Result<String, AppError> {
    if id.into_inner() == 0 {
        // 用户传入错误参数
        return Err(AppError::BadRequest("User ID cannot be 0".into()));
    }

    // 假设数据库连接失败
    let db_result: Result<(), ()> = Err(());

    db_result.map_err(|_| AppError::InternalError)?;

    Ok("User Found".into())
}
```
