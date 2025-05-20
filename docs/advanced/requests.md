# Requests 请求体

Actix Web 支持多种请求体（payload）格式，比如：

- JSON（application/json）
- 表单（application/x-www-form-urlencoded）
- 分块传输（Chunked）
- 原始流（Streaming）
- 多部分表单（multipart/form-data）

## JSON 请求体

使用 `Json<T>` 提取器。

添加 `Cargo.toml` 依赖：

```toml
[dependencies]
serde = { version = "1.0", features = ["derive"] }
```

```rust
use actix_web::{web, App, HttpServer, Result};
use serde::Deserialize;

#[derive(Deserialize)]
struct Info {
    username: String,
}

async fn index(info: web::Json<Info>) -> Result<String> {
    Ok(format!("Welcome {}!", info.username))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| App::new().route("/", web::post().to(index)))
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}

```

## 分块传输编码

适用于你想手动控制 body 大小、安全校验等情况。

```toml
[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1"
futures = "0.3"
```

```rust
use actix_web::{post, web, Error, HttpResponse};
use futures::StreamExt;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct MyObj {
    name: String,
    number: i32,
}

#[post("/")]
async fn index_manual(mut payload: web::Payload) -> Result<HttpResponse, Error> {
    const MAX_SIZE: usize = 262_144;
    let mut body = web::BytesMut::new();

    while let Some(chunk) = payload.next().await {
        let chunk = chunk?;
        if (body.len() + chunk.len()) > MAX_SIZE {
            return Err(actix_web::error::ErrorBadRequest("overflow"));
        }
        body.extend_from_slice(&chunk);
    }

    let obj = serde_json::from_slice::<MyObj>(&body)?;
    Ok(HttpResponse::Ok().json(obj))
}

```

## 表单请求体

支持 `application/x-www-form-urlencoded`，用 `web::Form<T>` 提取器。

```rust
use actix_web::{post, web, HttpResponse};
use serde::Deserialize;

#[derive(Deserialize)]
struct FormData {
    username: String,
}

#[post("/")]
async fn index(form: web::Form<FormData>) -> HttpResponse {
    HttpResponse::Ok().body(format!("username: {}", form.username))
}
```

## 原始流读取

适合处理超大请求体或文件上传的自定义场景。

```rust
use actix_web::{get, web, Error, HttpResponse};
use futures::StreamExt;

#[get("/")]
async fn index(mut body: web::Payload) -> Result<HttpResponse, Error> {
    let mut bytes = web::BytesMut::new();

    while let Some(item) = body.next().await {
        let item = item?;
        println!("Chunk: {:?}", &item);
        bytes.extend_from_slice(&item);
    }

    Ok(HttpResponse::Ok().finish())
}
```

## 内容压缩支持

Actix Web 自动解压以下类型的压缩请求体：

- `br`（Brotli）
- `gzip`
- `deflate`
- `zstd`

无需手动处理，只要请求头 Content-Encoding 标注了，`web::Payload` 就是已解压后的流。

## 多部分表单

上传文件、图片等场景可用。

需额外依赖：

```toml
[dependencies]
actix-multipart = "0.6"
```