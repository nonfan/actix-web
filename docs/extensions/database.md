# 数据库

## Diesel

当前版本的 Diesel （v1/v2） 不支持异步作，因此使用 `web::block` 函数将数据库作卸载到 Actix 运行时线程池非常重要。

```rust
type DbPool = r2d2::Pool<r2d2::ConnectionManager<SqliteConnection>>;

#[actix_web::main]
async fn main() -> io::Result<()> {
    // 连接 SQLite 数据库
    let manager = r2d2::ConnectionManager::<SqliteConnection>::new("app.db"); // 数据库路径
    let pool = r2d2::Pool::builder()
    .build(manager)
    .expect("database URL should be valid path to SQLite DB file");

    HttpServer::new(move || {
        App::new()
        .app_data(web::Data::new(pool.clone()))
        .route("/{name}", web::get().to(index))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

现在，在请求处理程序中，使用 `Data<T>` 提取器从应用程序状态获取池并从中获取连接。这提供了一个可以传递到 `web::block`
闭包的拥有的数据库连接。然后，只需使用必要的参数调用 action 函数并 `.await` 结果。

这个例子还在使用 `?` 运算符之前将错误映射到 HttpResponse，但是如果你的返回错误类型实现了 `ResponseError`，则这不是必需的。

```rust
async fn index(
    pool: web::Data<DbPool>,
    name: web::Path<(String)>,
) -> actix_web::Result<impl Responder> {
    let name = name.into_inner();

    let user = web::block(move || {
        let mut conn = pool.get().expect("couldn't get db connection from pool");
        insert_new_user(&mut conn, name)
    })
    .await?
    .map_err(error::ErrorInternalServerError)?;

    Ok(HttpResponse::Ok().json(user))
}
```