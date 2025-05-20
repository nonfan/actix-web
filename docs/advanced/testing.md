# 测试

每个应用程序都应该经过很好的测试。Actix Web 提供了针对您的应用程序执行集成测试的工具，以及用于**自定义提取器**和**中间件**
的单元测试工具。

Actix Web 提供了请求生成器类型。TestRequest 实现了一个类似构建器的模式。您可以使用 `to_http_request()` 生成 HttpRequest
实例，并使用它调用处理程序或提取器。

## TestRequest 与测试工具

Actix Web 提供了内置的测试工具（在 `actix_web::test` 模块中）来编写单元测试与集成测试。

- `TestRequest`: 用于构造测试用的 HTTP 请求（支持 `get()`, `post()` 等链式构造）
- `call_service`: 用于执行构造的请求并获取响应。
- `init_service`: 启动带有指定服务（routes）的测试 App 实例。

```rust
#[cfg(test)]
mod tests {
    use actix_web::{http::header::ContentType, test, App};

    use super::*;

    #[actix_web::test]
    async fn test_index_get() {
        let app = test::init_service(App::new().service(index)).await;
        let req = test::TestRequest::default()
        .insert_header(ContentType::plaintext())
        .to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }

    #[actix_web::test]
    async fn test_index_post() {
        let app = test::init_service(App::new().service(index)).await;
        let req = test::TestRequest::post().uri("/").to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_client_error());
    }
}
```

如果您需要更复杂的应用程序配置，测试应该与创建普通应用程序非常相似。例如，您可能需要初始化应用程序状态。使用 `data` 方法创建
App 并附加状态，就像在普通应用程序中一样。

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, web, App};

    #[actix_web::test]
    async fn test_index_get() {
        let app = test::init_service(
            App::new()
            .app_data(web::Data::new(AppState { count: 4 }))
            .service(index),
        )
        .await;
        let req = test::TestRequest::get().uri("/").to_request();
        let resp: AppState = test::call_and_read_body_json(&app, req).await;

        assert_eq!(resp.count, 4);
    }
}
```

## 流式响应测试

当你的接口返回的是 **流式数据**（streaming response），如：

- Server Sent Events（SSE）
- WebSocket（虽然不是直接用 Actix Web 测试）
- 或分块响应（chunked response）

这类响应不是“一次性”返回完数据，而是**分批次传输内容**。

**示例背景**: 一个 GET 接口每隔一段时间返回一条数据，返回内容长这样：

```text
data: 5
data: 4
data: 3
data: 2
data: 1
```

你可以选择测试每个流的数据内容（逐 chunk 验证） 或者读取完整流（一次性验证）。
:::code-group

```rs [逐个 chunk 拉取内容]
let body = resp.into_body();
pin!(body); // 使 body 可以被多次轮询

let bytes = future::poll_fn(|cx| body.as_mut().poll_next(cx)).await;
assert_eq!(bytes.unwrap().unwrap(), web::Bytes::from_static(b"data: 5\n\n"));
```

```rs [一次性获取所有数据并断言整体内容]
let bytes = body::to_bytes(body).await;
assert_eq!(
    bytes.unwrap(),
    web::Bytes::from_static(b"data: 5\n\ndata: 4\n\ndata: 3\n\ndata: 2\n\ndata: 1\n\n")
);
```

:::

## 单元测试 Extractor 或 Handler

如果你写了自定义的提取器（Extractor）、中间件（Middleware），或你想测试单独的 handler 函数行为，而不是通过 HTTP 路由，那就可以直接测试
handler 函数。

**示例**：测试带条件逻辑的 handler。

```rust
async fn index(req: HttpRequest) -> HttpResponse {
    if req.headers().contains_key("Content-Type") {
        HttpResponse::Ok().finish()
    } else {
        HttpResponse::BadRequest().finish()
    }
}

#[actix_web::test]
async fn test_index_ok() {
    let req = test::TestRequest::default()
    .insert_header(ContentType::plaintext()) // 模拟 header
    .to_http_request();

    let resp = index(req).await;
    assert_eq!(resp.status(), http::StatusCode::OK);
}
```