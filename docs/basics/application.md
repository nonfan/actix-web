# App 应用程序

actix-web 提供了各种使用 Rust 构建 Web 服务器和应用程序的原语。它提供路由、中间件、请求预处理、响应后处理等功能。

所有 actix-web 服务器都是围绕 App 实例构建的。它用于注册资源和中间件的路由。它还存储在同一范围内的所有处理程序之间共享的应用程序状态。

## State 状态

应用程序状态与同一范围内的所有路由和资源共享。可以使用 `web::Data<T>` 提取器访问状态，其中 T 是状态的类型。中间件也可以访问
State。

让我们编写一个简单的应用程序，并将应用程序名称存储在 state 中：

```rust
use actix_web::{get, web, App, HttpServer};

// 该结构体代表共享状态的类型，可以使用任意名称
struct AppState {
    app_name: String,
}

// 提取器用法 web::Data<AppState>，不限制参数位置（后续讲解提取器会清楚）
#[get("/")]
async fn index(data: web::Data<AppState>) -> String {
    let app_name = &data.app_name; // <- 获取 app_name 引用
    format!("Hello {app_name}!") // <- 携带响应数据 app_name
}
```

接下来传入初始化 App 时的状态，启动应用：

```rust {4-7}
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
        .app_data(web::Data::new(AppState {
            app_name: String::from("Actix Web"),
        }))
        .service(index)
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

可以在应用程序中注册任意数量的状态类型。

## 共享可变状态

`HttpServer` 接收的不是一个“应用实例”，而是一个“应用工厂”（也就是一个创建 App 的闭包）。每个线程都会用这个工厂去“新建一个
App 实例”，也就是说：每个线程都会拥有自己的一份 App 应用副本。

因此，如果你在 `App::new()` 里创建了某些数据（比如状态、配置），那么这些数据也会被“创建多份”——每个线程一份。

**那如果我想让所有线程共享一份数据怎么办:question:**

你就需要用 可以跨线程共享的数据结构，也就是：

- 实现了 `Send` + `Sync` 的对象
- 使用 Arc、Mutex 等线程安全容器

Actix Web 自带的 `web::Data` 内部已经帮你封装好了 `Arc`，你只要把 `Data` 放在闭包外，克隆进去即可实现多线程共享。

```rust
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let shared_data = web::Data::new(MySharedState); // 创建一次

    HttpServer::new(move || {
        App::new()
        .app_data(shared_data.clone()) // 每个线程 clone 一份 Arc 的引用
    })
}
```

在以下示例中，我们将编写一个具有可变共享状态的应用程序。

首先，我们定义我们的 state 并创建我们的处理程序：

```rust
use actix_web::{web, App, HttpServer, Responder};
use std::sync::Mutex;

// 定义共享状态结构体
struct MySharedState {
    counter: Mutex<i32>, // Mutex 保证线程安全
}

// 处理请求的函数
async fn index(data: web::Data<AppState>) -> impl Responder {
    let mut count = data.counter.lock().unwrap(); // 获取 Mutex 中的数据
    *count += 1; // 每次请求 +1
    format!("访问次数：{}", count)
}
```

其次，在 App 中注册数据：

```rust
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // 注意：Data 放在外面，只创建一次，用 clone 引入每个线程
    let shared_data = web::Data::new(AppState {
        counter: Mutex::new(0),
    });

    HttpServer::new(move || {
        App::new()
        .app_data(shared_data.clone()) // 每个线程用 clone 引用 Arc
        .route("/", web::get().to(index))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

在多线程工作下，要实现全局共享状态 ，必须在传递给 `HttpServer::new` 的闭包之外创建它，并移动/克隆它。

## Scope 前缀

应用程序的 scope 充当所有路由的命名空间，即特定应用程序 scope 的所有路由都具有相同的 url
路径前缀。应用程序前缀始终包含前导 “/” 斜杠。如果提供的前缀不包含前导斜杠，则会自动插入该前缀。前缀应由值路径段组成。

```rust
use actix_web::{web, App, HttpServer, Responder};

async fn index() -> impl Responder {
    "Hello world!"
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new().service(
            web::scope("/app")
            .route("/index.html", web::get().to(index)),
        )
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

在此示例中，将创建具有 `/app` 前缀和 `index.html` 资源的应用程序。此资源可通过 `/app/index.html` URL 获取。

### 使用 Scope 来组织应用

`web::scope()` 是 Actix Web 提供的一个功能，它可以给一组路由统一加上前缀，方便模块化管理。

就像给这组接口设置了一个“命名空间”。

```rust
fn main() {
    let scope = web::scope("/users").service(show_users);
    App::new().service(scope);
}
```

上面示例把 `show_users` 这个路由挂载到 `/users` 前缀下如果原本路径是 `/show`，现在就变成了 `/users/show`
。这样做的有两个好处是：路由清晰，按模块分类、可以灵活组合多个不同模块的接口。

## 应用程序守卫

在 Actix Web 中，“守卫（Guard）” 就是一个 过滤条件，用来判断某个请求是否匹配当前的路由或 scope。类似小区门禁，有人脸记录可进入。

```rust
fn main() {
    web::scope("/")
    .guard(guard::Host("www.rust-lang.org"))
    .route("", web::to(|| async { HttpResponse::Ok().body("www") }))
}
```

示例只有当请求的 Host 是 `www.rust-lang.org` 时，这个 scope 中的路由才会生效。否则就不会匹配，Actix Web 会继续找其他路由或返回
404。

你可以把守卫看作一个简单的函数，它接受一个请求对象引用并返回 true 或 false。从形式上讲，守卫是实现 Guard trait 的任何对象。Actix
Web
提供了几个保护。您可以查看 [API 文档的 functions](https://docs.rs/actix-web/4.11.0/actix_web/guard/index.html#functions)
部分 。

**常见守卫：**

| 守卫名                  | 功能说明                       |
|----------------------|----------------------------|
| `guard::Get()`       | 只匹配 GET 请求                 |
| `guard::Post()`      | 只匹配 POST 请求                |
| `guard::Host("xxx")` | 只匹配特定域名的请求                 |
| 自定义                  | 实现 `Guard` trait，自定义任意判断逻辑 |

### 虚拟托管

**虚拟托管**是指：在同一个服务器（IP + 端口）上，通过不同的域名，提供不同的网站内容或服务。

这是我们平时建站常见的方式，比如：

- `www.example.com` 显示主站内容

- `api.example.com` 显示 API 接口

- `user.example.com` 显示用户系统

在 Actix Web 中就可以这样做：

```rust
#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
        .service(
            web::scope("/")
            .guard(guard::Host("www.rust-lang.org"))
            .route("", web::to(|| async { HttpResponse::Ok().body("www") })),
        )
        .service(
            web::scope("/")
            .guard(guard::Host("users.rust-lang.org"))
            .route("", web::to(|| async { HttpResponse::Ok().body("user") })),
        )
    })
}
```

## Configure 配置

为了简单和可重用，App 和 `web::scope` 都提供了 `configure` 方法。此功能可用于将部分 configuration 移动到不同的 module 甚至
library 。例如，可以将某些资源的配置移动到其他模块。

```rust
use actix_web::{web, App, HttpResponse, HttpServer};

// 这个函数可以放到其他模块里，用来配置 /api 范围下的路由
fn scoped_config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/test") // 定义路径 /api/test
        .route(web::get().to(|| async {
            HttpResponse::Ok().body("test") // 处理 GET 请求，返回 "test"
        }))
        .route(web::head().to(HttpResponse::MethodNotAllowed)), // HEAD 请求不允许
    );
}

// 这个函数也可以放到其他模块里，用来配置 /app 路由
fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/app") // 定义路径 /app
        .route(web::get().to(|| async {
            HttpResponse::Ok().body("app") // 处理 GET 请求，返回 "app"
        }))
        .route(web::head().to(HttpResponse::MethodNotAllowed)), // HEAD 请求不允许
    );
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
        .configure(config) // 注册通用配置（如 /app 路由）
        .service(
            web::scope("/api") // 设置作用域前缀为 /api
            .configure(scoped_config), // 加载作用域内的路由配置（如 /api/test）
        )
        .route(
            "/", // 根路径
            web::get().to(|| async {
                HttpResponse::Ok().body("/") // 返回 "/"
            }),
        )
    })
    .bind(("127.0.0.1", 8080))? // 绑定本地端口 8080
    .run()
    .await
}
```

**🚀 最终效果说明**

| 请求地址                  | 响应结果                    |
|-----------------------|-------------------------|
| `/`                   | `/`                     |
| `/app`                | `app`                   |
| `/api/test`           | `test`                  |
| `/api/test` 的 HEAD 请求 | 405（Method Not Allowed） |
