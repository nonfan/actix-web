# 提取器

在 Actix Web 中，提取器是一种从**请求中自动提取数据**的方法。比如从路径、查询参数、请求体里提取数据，Actix
会自动解析这些内容并传给你的处理函数。

提取器是通过实现 FromRequest trait 的类型。你只要在路由函数参数中写对了类型，Actix 就会帮你提数据！

提取器可以作为处理程序函数的参数进行访问，Actix Web 支持每个处理程序函数**最多 12 个提取器**。

**但有个例外**：如果一个提取器需要读取请求体（例如 `web::Json`、`web::Bytes`、`web::Form`
等），那么只有第一个读取请求体的提取器才能成功，后面的将失败。因为请求体（body）是个一次性流（stream），读完一次就不能再读了。

Actix-web 提供[多种内置的提取器](https://docs.rs/actix-web/latest/actix_web/trait.FromRequest.html#implementors)，常见的有：

- `Path`：从 URL 路径中提取动态参数。
- `Query`：从 URL 查询字符串中提取参数。
- `Json`：从请求体中提取 JSON 数据。
- `Form`：从表单数据中提取参数。
- `Data`：从应用程序状态中提取共享数据。

## Path 提取器

> 提取路径参数

比如你定义了一个路由 `/users/{user_id}/{friend}`，你可以用 `Path<(u32, String)>` 或结构体接收参数：

### 用元组提取

```rust
#[get("/users/{user_id}/{friend}")]
async fn index(path: web::Path<(u32, String)>) -> Result<String> {
    let (user_id, friend) = path.into_inner();
    Ok(format!("欢迎 {}, 用户ID是 {}!", friend, user_id))
}
```

### 结构体提取

如果你想用 `Path` 提取器直接将 URL 路径中的动态参数提取为一个结构体，必须对结构体实现反序列化（通常通过 serde 的
`Deserialize` 特性）。这是因为 Actix-web 使用 serde 来将路径参数解析并映射到结构体的字段。

```rust
#[derive(Deserialize)]
struct Info {
    user_id: u32,
    friend: String,
}

#[get("/users/{user_id}/{friend}")]
async fn index(info: web::Path<Info>) -> Result<String> {
    Ok(format!("欢迎 {}, 用户ID是 {}!", info.friend, info.user_id))
}
```

作为非类型安全的替代方案，也可以在处理程序中按名称查询（参见 [match_info](https://docs.rs/actix-web/latest/actix_web/struct.HttpRequest.html#method.match_info)
文档 ）路径参数的请求：

```rust
#[get("/users/{user_id}/{friend}")]
async fn index(req: HttpRequest) -> Result<String> {
    let name: String = req.match_info().get("friend").unwrap().parse().unwrap();
    let userid: i32 = req.match_info().query("user_id").parse().unwrap();

    Ok(format!("Welcome {}, user_id {}!", name, userid))
}
```

## Query 提取器

> 提取查询参数

查询字符串是 URL 中 `?` 后面的部分，比如 `http://127.0.0.1:8080/search?name=Alice&age=25` 你想提取 `name` 和 `age`。

```rust
#[derive(Deserialize)]
struct SearchQuery {
    name: String,
    age: i32,
}

#[get("/search")]
async fn search(query: web::Query<SearchQuery>) -> impl Responder {
    let query = query.into_inner();
    format!("搜索用户: {}，年龄: {}", query.name, query.age)
}
```

如果查询参数缺失或类型不对，Actix-web 会返回 400 错误。

## JSON 提取器

> 从请求体取 JSON 数据

如果客户端发送 POST 请求，请求体是 JSON 数据，比如 `{"name": "Bob", "age": 30}`，可以用 Json 提取器。

```rust
#[derive(Deserialize)]
struct User {
    name: String,
    age: i32,
}

#[post("/user")]
async fn create_user(user: web::Json<User>) -> impl Responder {
    let user = user.into_inner();
    format!("创建用户: {}，年龄: {}", user.name, user.age)
}
```

**可选：设置最大请求大小 + 自定义错误处理:**

```rs
let json_config = web::JsonConfig::default()
    .limit(4096)
    .error_handler(|err, _| {
        error::InternalError::from_response(err, HttpResponse::Conflict().finish()).into()
    });

App::new().app_data(json_config)
```

## Form 提取器

> 从表单数据取参数

如果客户端提交 HTML 表单（比如 `application/x-www-form-urlencoded` 格式），可以用 Form 提取器。

```rust
#[derive(Deserialize)]
struct FormData {
    username: String,
    email: String,
}

#[post("/submit")]
async fn submit(form: web::Form<FormData>) -> impl Responder {
    let form = form.into_inner();
    format!("提交表单: 用户名={}, 邮箱={}", form.username, form.email)
}
```

## 共享状态提取器

如果你在应用中存储了共享状态（比如数据库连接池），可以用 Data 提取器访问它。

```rust
use actix_web::{get, web, App, HttpServer, Responder};
use std::sync::Mutex;

#[get("/counter")]
async fn counter(data: web::Data<Mutex<i32>>) -> impl Responder { // [!code highlight:4]
    let mut counter = data.lock().unwrap();
    *counter += 1;
    format!("访问次数: {}", counter)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let counter = web::Data::new(Mutex::new(0)); // [!code highlight]
    HttpServer::new(move || {
        App::new()
        .app_data(counter.clone())
        .service(counter)
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
```

**其他提取器一览:**

| 提取器            | 说明      |
|----------------|---------|
| `HttpRequest`  | 原始请求对象  |
| `Bytes`        | 原始字节请求体 |
| `Payload`      | 底层请求体流  |
| `String`       | 请求体转字符串 |

