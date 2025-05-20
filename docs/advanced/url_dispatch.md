# URL Dispatch

> Actix-web 是一个高性能的 Rust Web 框架，其 URL 分派机制是其核心功能之一，用于将客户端的 HTTP 请求映射到相应的处理程序。

## 什么是 URL Dispatch:question:

URL 分派是指 Actix-web 将客户端的 HTTP 请求（包括 URL 路径和方法）映射到特定处理程序（handler）的过程。它是 Actix-web
的路由系统，负责根据请求的路径和 HTTP 方法（如 GET、POST 等）调用相应的逻辑。

**关键点：**

- **处理程序**（Handler）：一个函数，接受从请求中提取的参数（实现了 FromRequest trait），并返回可以转换为 HTTP 响应的类型（实现了
  Responder trait）。
- **模式匹配**：URL 分派基于路径模式（如 `/users/{id}`）匹配请求路径，仅匹配路径部分（不包括查询参数，如 `?key=value`）。
- **高效灵活**：Actix-web 的路由系统支持静态路由、动态路由、正则表达式匹配和路由分组等功能。

## 核心内容

Actix-web 的 URL 分派主要通过以下几个核心组件实现：

### 简单路由注册

`App::route()` 是最简单的方式，用于快速注册单个路由。它需要指定路径模式、HTTP 方法和处理程序。

```rust
use actix_web::{web, App, HttpResponse, HttpServer};

async fn index() -> HttpResponse {
    HttpResponse::Ok().body("Hello")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
        .route("/", web::get().to(index)) // 注册 GET / 路由
        .route("/user", web::post().to(index)) // 注册 POST /user 路由
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

- `App::new()` 创建一个新的应用实例。
- `.route(path, method)` 用于定义单个路由，指定路径和 HTTP 方法（如 GET、POST）。
- `.to(handler)` 指定处理请求的函数或闭包。

### 资源配置

:one: 当你的 handler 函数已经通过 `#[get("/path")]` 或类似宏指定了路径和方法，就可以直接把这个函数通过 `App::service()`
注册到应用中。

```rust
use actix_web::{get, post, App, HttpServer, Responder};

#[get("/hello")]
async fn hello() -> impl Responder {
    "Hello GET"
}
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
        .service(hello)
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
```

:two: `App::service()` 用于更复杂的资源配置，允许为同一路径定义多个 HTTP 方法的处理程序，并支持守卫（Guard）条件。

```rust
use actix_web::{guard, web, App, HttpResponse};

async fn index() -> HttpResponse {
    HttpResponse::Ok().body("Hello")
}

pub fn main() {
    App::new()
    .service(web::resource("/prefix").to(index)) // 简单资源
    .service(
        web::resource("/user/{name}") // 动态路径
        .name("user_detail") // 资源名称，用于 URL 生成
        .guard(guard::Header("content-type", "application/json")) // 守卫条件
        .route(web::get().to(HttpResponse::Ok)) // GET 方法
        .route(web::put().to(HttpResponse::Ok)), // PUT 方法
    );
}
```

**说明：**

- `web::resource(path)` 定义一个资源，包含路径模式。
- `.name()` 设置资源名称，用于生成 URL。
- `.guard()` 添加守卫条件（如请求头检查）。
- `.route()` 为资源添加具体路由规则。
- 如果资源没有匹配的路由，返回 404（NOT FOUND）。

### 路由配置

每个资源可以包含多个路由（Route），每个路由由守卫和一个处理程序组成。`resource::route()` 创建一个新路由，默认匹配所有请求（无守卫），默认处理程序返回
404。

```rs
use actix_web::{guard, web, App, HttpResponse};

App::new().service(
    web::resource("/path").route(
        web::route()
            .guard(guard::Get()) // 仅匹配 GET 请求
            .guard(guard::Header("content-type", "text/plain")) // 要求特定请求头
            .to(HttpResponse::Ok), // 处理程序
    ),
);
```

**说明：**

- `.guard()` 添加守卫条件，多个守卫必须全部满足。
- `.method()` 指定 HTTP 方法（如 guard::Get()）。
- `.to()` 设置异步处理程序（每个路由只能有一个处理程序）。

### 路由分组

`web::scope()` 用于将一组路由分组，共享相同的前缀路径，适合模块化组织路由。

```rust
use actix_web::{get, web, App, HttpResponse, HttpServer};

#[get("/show")]
async fn show_users() -> HttpResponse {
    HttpResponse::Ok().body("Show users")
}

#[get("/show/{id}")]
async fn user_detail(path: web::Path<(u32,)>) -> HttpResponse {
    HttpResponse::Ok().body(format!("User detail: {}", path.into_inner().0))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new().service(
            web::scope("/users") // 前缀 /users
            .service(show_users) // /users/show
            .service(user_detail), // /users/show/{id}
        )
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

### 路由模块化配置

在实际开发中，如果你把所有的路由都堆在 `main.rs` 里，会很快变得臃肿难维护。

Actix Web 提供 `.configure()` 方法，允许你将某一组路由抽成独立函数，甚至独立模块，增强项目可维护性和可读性。

```rust
use actix_web::{web, App, HttpResponse, HttpServer, Responder};

async fn user_list() -> impl Responder {
    HttpResponse::Ok().body("用户列表")
}

// 用户模块路由配置
fn configure_user_scope(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/list").route(web::get().to(user_list))
    );
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new().service(
            web::scope("/users").configure(configure_user_scope)
        )
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

## 路由匹配机制

Actix-web 的路由匹配过程如下：

1. 解析请求：提取请求的路径和 HTTP 方法。
2. 按顺序匹配：
    - 按 `App::service()` 定义的资源顺序检查。
    - 每个资源按其路由的定义顺序匹配。
    - 静态路径优先于动态路径。
3. 守卫检查：所有守卫条件（如 HTTP 方法、请求头）必须满足。
4. 调用处理程序：找到匹配的路由后调用处理程序。
5. 默认处理：如果没有匹配的路由，返回 404（NOT FOUND）。

注意：

- 路由匹配是顺序敏感的，先定义的路由优先匹配。
- 如果资源没有匹配的路由，使用默认资源（返回 404）。

## 路径模式语法

Actix-web 使用简单的路径模式语法，支持静态路径、动态参数和正则表达式。

### 基本语法

路径可以以 `/` 开头，若无 `/`，会自动添加。动态参数使用 `{identifier}` 表示，匹配直到下一个 `/` 的字符。

```rs
foo/{baz}/{bar}

// 匹配：
// foo/1/2 → Params {'baz': '1', 'bar': '2'}
// foo/abc/def → Params {'baz': 'abc', 'bar': 'def'}

// 不匹配：
// foo/1/2/（末尾多余斜杠）
// bar/abc/def（首段不匹配）
```

### 正则表达式

动态参数可以通过正则表达式限制匹配内容，语法为 `{identifier:regex}`。

```rs
foo/{name:\d+}

// 匹配：foo/123（name=123）
// 不匹配：foo/abc（非数字）
```

### 尾部匹配

使用 `{tail:.*}` 捕获路径的剩余部分。

```rs
foo/{bar}/{tail:.*}

// 匹配：
// foo/1/2/ → Params {'bar': '1', 'tail': '2/'}
// foo/abc/def/a/b/c → Params {'bar': 'abc', 'tail': 'def/a/b/c'}
```

## 生成资源 URL

通过 `HttpRequest::url_for(name, params)` 生成基于资源名称的 URL，前提是资源已设置名称（`.name()`）。

```rust
use actix_web::{get, guard, http::header, HttpRequest, HttpResponse, Result};

#[get("/test/")]
async fn index(req: HttpRequest) -> Result<HttpResponse> {
    let url = req.url_for("foo", ["1", "2", "3"])?; // 生成 URL
    Ok(HttpResponse::Found()
    .insert_header((header::LOCATION, url.as_str())) // 访问 /test/ 会重定向到 /test/1/2/3。
    .finish())
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    use actix_web::{web, App, HttpServer};

    HttpServer::new(|| {
        App::new()
        .service(
            web::resource("/test/{a}/{b}/{c}")
            .name("foo") // 设置资源名称
            .guard(guard::Get())
            .to(HttpResponse::Ok),
        )
        .service(index)
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

## 外部资源

外部资源是仅用于 URL 生成的资源（如外部 URL），不会用于请求匹配。

```rust
use actix_web::{get, App, HttpRequest, HttpServer, Responder};

#[get("/")]
async fn index(req: HttpRequest) -> impl Responder {
    let url = req.url_for("youtube", ["oHg5SJYRHA0"]).unwrap();
    assert_eq!(url.as_str(), "https://youtube.com/watch/oHg5SJYRHA0"); // 访问 / 返回 https://youtube.com/watch/oHg5SJYRHA0。
    url.to_string()
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
        .service(index)
        .external_resource("youtube", "https://youtube.com/watch/{video_id}")
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

## 路径规范化

路径规范化处理多余斜杠或缺失斜杠的情况，通过 `middleware::NormalizePath` 实现。

```rust
use actix_web::{middleware, HttpResponse};

async fn index() -> HttpResponse {
    HttpResponse::Ok().body("Hello")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    use actix_web::{web, App, HttpServer};

    HttpServer::new(|| {
        App::new()
        .wrap(middleware::NormalizePath::default()) // 启用路径规范化
        .route("/resource/", web::to(index)) // 访问 //resource/// 会重定向到 /resource/。
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

POST 请求的规范化可能导致数据丢失，建议仅对 GET 请求启用规范化。

## 自定义守卫 (Guard)

守卫是一个实现了 `Guard` trait 的对象，用于检查请求是否满足特定条件（如请求头、方法等）。

```rust
use actix_web::{guard::{Guard, GuardContext}, http, HttpResponse};

struct ContentTypeHeader;

impl Guard for ContentTypeHeader {
    fn check(&self, req: &GuardContext) -> bool {
        req.head().headers().contains_key(http::header::CONTENT_TYPE)
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    use actix_web::{web, App, HttpServer};

    HttpServer::new(|| {
        App::new().route(
            "/",
            web::route().guard(ContentTypeHeader).to(HttpResponse::Ok),
        )
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

**守卫组合**

- `guard::Not(guard)`：反转守卫条件。
- `guard::Any(guard1).or(guard2)`：任一守卫满足即可。
- `guard::All(guard1).and(guard2)`：所有守卫都必须满足。

示例：限制非 GET 请求

```rust
use actix_web::{guard, web, App, HttpResponse, HttpServer};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new().route(
            "/",
            web::route()
            .guard(guard::Not(guard::Get())) // 除了GET请求，其他 "/" 请求不允许
            .to(HttpResponse::MethodNotAllowed),
        )
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

## 自定义 404 响应

默认情况下，未匹配的路由返回 404（NOT FOUND）。通过 `App::default_service()` 可以自定义 404 响应。

```rust
use actix_web::{web, App, HttpResponse, HttpServer};

async fn index() -> HttpResponse {
    HttpResponse::Ok().body("Hello")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
        .service(web::resource("/").route(web::get().to(index)))
        .default_service(
            web::route()
            .guard(guard::Not(guard::Get()))
            .to(HttpResponse::MethodNotAllowed), // 自定义非 GET 请求的响应
        )
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```