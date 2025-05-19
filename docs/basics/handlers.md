# 请求处理程序

请求处理程序是一个异步函数，它接受零个或多个可以从请求中提取的参数（即 impl FromRequest），并返回一个可以转换为
`HttpResponse` 的类型（即 impl Responder）。

在 Actix Web 中，请求处理器就是你定义的处理请求的 `async` 函数，也就是我们常写的：

```rust
async fn index() -> impl Responder {
    "Hello world!"
}
```

它负责接收客户端请求，处理完后返回响应。

请求处理分两个阶段进行。首先调用 handler 对象，返回实现 `Responder` trait 的任何对象。然后，在返回的对象上调用
`respond_to()`， 将自身转换为 `HttpResponse` 或 `Error`。

默认情况下，Actix Web 为一些标准类型提供了 Responder 实现，例如 `&'static str`、`String` 等。

例如返回 `&'static str`、`String` 类型处理程序的示例：

```rust
async fn index(_req: HttpRequest) -> &'static str {
    "Hello world!"
}
```

```rust
async fn index(_req: HttpRequest) -> String {
    "Hello world!".to_owned()
}
```

## 自定义返回类型

如果你想要返回一个自定义结构体（比如 JSON 对象），你要给它实现 `Responder` trait。

让我们为序列化为 `application/json` 响应的自定义类型创建一个响应：

```rust
use actix_web::{Responder, HttpResponse, HttpRequest, http::header::ContentType};
use serde::Serialize;

#[derive(Serialize)]
struct MyObj {
    name: &'static str,
}

impl Responder for MyObj {
    type Body = actix_web::body::BoxBody;

    fn respond_to(self, _req: &HttpRequest) -> HttpResponse<Self::Body> {
        let body = serde_json::to_string(&self).unwrap();

        HttpResponse::Ok()
        .content_type(ContentType::json())
        .body(body)
    }
}

async fn index() -> impl Responder {
    MyObj { name: "user" }
}

```

## 流式处理响应正文

有时候你需要一边生成一边发送响应，比如下载大文件、推送事件。

Actix 支持 `streaming`，你只需要返回一个实现了 `Stream<Item = Result<Bytes, Error>>` 的类型：

```rust
use actix_web::{get, web, App, HttpResponse, HttpServer};
use futures::{stream::once, future::ok};

#[get("/stream")]
async fn stream() -> HttpResponse {
    let body = once(ok::<_, actix_web::Error>(web::Bytes::from_static(b"test")));

    HttpResponse::Ok()
    .content_type("application/json")
    .streaming(body)
}
```

## 返回不同类型（使用 Either）

有时候你需要根据情况返回两种完全不同的类型，比如：

- 一种是错误信息 `HttpResponse`

- 一种是成功信息 `String`

可以使用 `actix_web::Either`：

```rust
use actix_web::{Either, Error, HttpResponse};

type MyResult = Either<HttpResponse, Result<&'static str, Error>>;

async fn index() -> MyResult {
    if some_condition() {
        Either::Left(HttpResponse::BadRequest().body("Invalid!"))
    } else {
        Either::Right(Ok("Success!"))
    }
}
```

`Either::Left(...)` 和 `Either::Right(...)` 让你灵活地返回不同类型。