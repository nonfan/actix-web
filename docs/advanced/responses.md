# Response 响应

在 Actix Web 中，响应是通过 `HttpResponse` 构造出来的，提供了 构建者模式（builder-like pattern），支持设置状态码、内容类型、响应头、响应体等。

方法 `.body`、`.finish` 和 `.json` 完成响应创建并返回一个构造的 `HttpResponse` 实例。如果在同一个 builder 实例上多次调用此方法，则
builder 将出现 panic。

```rust
use actix_web::{http::header::ContentType, HttpResponse};

async fn index() -> HttpResponse {
    HttpResponse::Ok()
    .content_type(ContentType::plaintext())
    .insert_header(("X-Hdr", "sample"))
    .body("data")
}
```

## JSON 响应

你可以使用 `web::Json` 直接返回结构体，Actix 会自动序列化为 JSON。

前提是你的结构体实现了 Serialize，需要加上 `serde = { version = "1.0", features = ["derive"] }` 依赖：

```rust
use actix_web::{get, web, Responder, Result};
use serde::Serialize;

#[derive(Serialize)]
struct MyObj {
    name: String,
}

#[get("/hello/{name}")]
async fn hello(name: web::Path<String>) -> Result<impl Responder> {
    let obj = MyObj {
        name: name.to_string(),
    };
    Ok(web::Json(obj))
}
```

## 响应压缩（自动/手动）

Actix Web 可以使用 `Compress` 中间件自动压缩有效负载。支持以下编解码器：

- `Brotli`
- `Gzip`
- `Deflate`
- `Identity`

:one: 自动压缩（根据浏览器 Accept-Encoding 自动选择）

```rust
use actix_web::{middleware, App, HttpServer, HttpResponse, get};

#[get("/")]
async fn index() -> HttpResponse {
    HttpResponse::Ok().body("Hello")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
        .wrap(middleware::Compress::default()) // 开启压缩中间件
        .service(index)
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

:two: 禁用某个接口的压缩

```rust
use actix_web::{get, http::header::ContentEncoding, HttpResponse};

#[get("/no-compress")]
async fn index() -> HttpResponse {
    HttpResponse::Ok()
    .insert_header(ContentEncoding::Identity) // 禁用压缩
    .body("No compression here")
}
```

:three: 已压缩的数据手动设置编码

```rust
use actix_web::{
    get, http::header::ContentEncoding, middleware, App, HttpResponse, HttpServer,
};

static HELLO_WORLD: &[u8] = &[
    0x1f, 0x8b, 0x08, 0x00, 0xa2, 0x30, 0x10, 0x5c, 0x00, 0x03, 0xcb, 0x48, 0xcd, 0xc9, 0xc9,
    0x57, 0x28, 0xcf, 0x2f, 0xca, 0x49, 0xe1, 0x02, 0x00, 0x2d, 0x3b, 0x08, 0xaf, 0x0c, 0x00,
    0x00, 0x00,
];

#[get("/")]
async fn index() -> HttpResponse {
    HttpResponse::Ok()
    .insert_header(ContentEncoding::Gzip)
    .body(HELLO_WORLD)
}
```