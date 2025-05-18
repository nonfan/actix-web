# 快速开始

实践出真知 —— 最推荐的学习方式是动手构建一个小型项目。在实际编码中，你将逐步掌握 Actix Web 的核心能力，从而为后续开发打下坚实基础。

> [!WARNING] Rust 版本
> Actix Web 目前支持的最低 Rust 版本 （MSRV） 为 1.72。运行 rustup update 将确保您拥有最新最好的 Rust 版本。因此，本指南假定您运行的是
> Rust 1.72 或更高版本。

## Hello, world

学习一门新语言或框架的传统方式，往往是从打印一句 “Hello, world” 开始。

在 Actix Web 中，我们也将通过一个简单的 Web 服务器来完成这个入门程序。首先，我们会创建一个新的**二进制类型的 Cargo
项目**，并运行一个极简的服务器，从而迈出学习 Actix Web 的第一步。

```bash
cargo new hello-world
cd hello-world
```

通过将以下内容添加到您的 `Cargo.toml` 文件中，将 `actix-web` 添加为项目的依赖项。

```toml
[dependencies]
actix-web = "4"
```

请求处理函数（handler）使用的是 async 异步函数，它们可以带有零个或多个参数。这些参数会自动从 HTTP 请求中提取出来（通过 FromRequest trait 实现），函数的返回值则必须是可以转换成 HttpResponse 的类型（通过实现 Responder trait 来实现）。

为了方便起见，我们将代码统一写入 `src/main.rs` 文件：

```rust
use actix_web::{get, post, web, App, HttpResponse, HttpServer, Responder};

#[get("/")]
async fn hello() -> impl Responder {
    HttpResponse::Ok().body("Hello world!")
}

#[post("/echo")]
async fn echo(req_body: String) -> impl Responder {
    HttpResponse::Ok().body(req_body)
}

async fn manual_hello() -> impl Responder {
    HttpResponse::Ok().body("Hey there!")
}
```

接下来，我们需要创建一个 App 实例，并把处理请求的函数注册进去。 如果你用的是像 `#[get]` 这样的路由宏，可以使用 `App::service` 来添加。如果你想手动指定路径和请求方法（比如 GET、POST），就用 `App::route`。

最后，我们会把这个 `App` 放进 `HttpServer` 里启动，它就会像一个“应用工厂”一样，负责接收并处理所有传入的请求。

```rust
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .service(hello)
            .service(echo)
            .route("/hey", web::get().to(manual_hello))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

就是这样！使用 `cargo run` 编译并运行程序。`#[actix_web::main]` 宏在 actix 运行时内执行 async main 函数。现在，您可以转到 `http://127.0.0.1:8080/` 或您定义的任何其他路由来查看结果。

> [!TIP] 导航
> [前往 GitHub 查看完整示例代码](https://github.com/nonfan/diesel-demo/tree/docs/examples/ch01_hello_world)