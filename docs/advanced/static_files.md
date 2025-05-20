# 静态文件

## 单个文件服务

当你希望返回一个用户请求的特定文件，比如 PDF 报告、图片、音频文件等，可以使用 NamedFile。它适合处理“指定路径”下的文件访问需求。

可以使用自定义路径模式和 NamedFile 提供静态文件。要匹配路径尾部，我们可以使用 `[.*]` 正则表达式。

```rust
use actix_files::NamedFile;
use actix_web::HttpRequest;
use std::path::PathBuf;

async fn index(req: HttpRequest) -> actix_web::Result<NamedFile> {
    let path: PathBuf = req.match_info().query("filename").parse().unwrap();
    Ok(NamedFile::open(path)?)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    use actix_web::{web, App, HttpServer};

    HttpServer::new(|| App::new().route("/{filename:.*}", web::get().to(index)))
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

> [!DANGER] 安全风险
> 这个设计存在一个重要问题 —— 路径穿越攻击(Path Traversal)：如果用户输入的路径是类似 `../../../etc/passwd`
> ，你的服务器可能会返回系统敏感文件。这种攻击的本质是绕过文件根目录，访问主机上不该暴露的资源。

应始终限定用户只能访问你设定的“安全目录”，并对输入路径进行合法性验证，例如：将路径拼接到指定根目录；使用 `canonicalize()`
方法获得规范路径；检查最终路径是否仍在允许目录下。

:::code-group

```rust [安全示范]
use actix_files::NamedFile;
use actix_web::{get, web, App, HttpRequest, HttpServer, Result};
use std::path::{PathBuf, Path};

#[get("/{filename:.*}")]
async fn index(req: HttpRequest) -> Result<NamedFile> {
    // 限定根目录
    let base_dir = Path::new("./static");

    // 提取路径参数
    let filename: PathBuf = req.match_info().query("filename").parse().unwrap();
    let full_path = base_dir.join(&filename);

    // 进行安全性检查，防止路径穿越
    let canon = full_path.canonicalize()?;
    if !canon.starts_with(base_dir.canonicalize()?) {
        return Err(actix_web::error::ErrorForbidden("Access denied"));
    }

    // 返回文件
    Ok(NamedFile::open(canon)?)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| App::new().service(index))
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

:::

## 目录服务

如果你要提供一个完整的静态资源目录，比如一个网页的前端资源（HTML、JS、CSS、图片等），就可以使用 `Files`。它会自动映射目录结构和
URL 路径，更安全、推荐用于网站的资源部署。

```rust
use actix_files as fs;
use actix_web::{App, HttpServer};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| App::new().service(fs::Files::new("/static", ".").show_files_listing()))
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

**特性：**

- 默认不会显示目录结构（避免暴露内部信息）
- 可以启用 `index_file()` 显示首页，如 index.html
- 可以开启文件列表显示 `show_files_listing()`，**但建议只用于调试**

## 配置

> 适用于 NamedFile 和 Files

:one: `use_last_modified(true)`

是否在响应头中添加 `Last-Modified`, 可以让浏览器能缓存文件，减少重复下载，且支持 304 Not Modified 响应，节省流量。

:two: `use_etag(true)`

是否自动生成 ETag 头（实体标签）, 为了更精确的缓存控制（对比 If-None-Match 请求头），浏览器可以根据 ETag 判断是否重新下载资源。

:three: `set_content_disposition(...)`

是否设置 `Content-Disposition` 响应头, 作用于控制浏览器行为(是打开还是下载文件)

常用值：

- `inline`：浏览器直接预览
- `attachment`：强制下载（下载窗口）

:::code-group

```rust [NamedFile 配置示例]
use actix_files::NamedFile;
use actix_web::http::header::{ContentDisposition, DispositionType};
use actix_web::{get, App, Error, HttpRequest, HttpServer};
use std::path::PathBuf;

#[get("/{filename:.*}")]
async fn index(req: HttpRequest) -> Result<NamedFile, Error> {
    let filename: PathBuf = req.match_info().query("filename").parse().unwrap();
    let file = NamedFile::open(filename)?;

    Ok(file
    .use_etag(true) // 开启 ETag 缓存
    .use_last_modified(true) // 开启 Last-Modified 缓存
    .set_content_disposition(ContentDisposition {
        disposition: DispositionType::Attachment, // 强制下载
        parameters: vec![],
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| App::new().service(index))
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}

```

```rust [Files 配置示例]
use actix_files::Files;
use actix_web::{App, HttpServer};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new().service(
            Files::new("/static", "./static")
            .use_last_modified(true) // 启用 Last-Modified 缓存头
            .use_etag(true)          // 启用 ETag 缓存
            .show_files_listing(),   // 展示目录结构（开发调试用）
        )
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}

```

:::