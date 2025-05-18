# 什么是 Actix Web:question:

`Actix Web` 是一个用 Rust 编写的高性能 Web 开发框架，它可以帮助你快速、自信地构建 Web 服务。

虽然名字叫“Actix”，但你不需要了解背后的 actor 系统也能轻松使用它。这个框架现在主要专注于 HTTP 服务开发，并已经脱离了原来的
actor 框架，变成了一个更加轻量、实用的微框架。

## 🚀 Actix Web 有哪些特点:question:

- **高性能**：Rust 本身就是为性能而生，而 Actix Web 在 Rust 的加持下，可以实现非常快速的 HTTP 服务，适合高并发场景。

- **异步编程**：Actix Web 完整支持 Rust 的 async/await 异步特性，让你可以轻松写出高效、非阻塞的代码。

- **内置服务器**：它自带 HTTP 服务器，支持 HTTP/1 和 HTTP/2，还能直接开启 TLS（也就是 HTTPS）。你甚至可以不用 nginx
  之类的代理，直接部署上线。

- **轻量灵活**：虽然它是个“微框架”，但功能却很全面，适合开发 API 服务、后台管理系统、小型网站等。

- **生态稳定**：它基于 Rust 稳定版本开发（最低支持 `Rust 1.72`），使用官方稳定工具链即可运行，无需 nightly 工具链。

## Actix 和 Actix Web 是一回事吗:question:

其实不是。最初，Actix Web 是基于 actor 模型的 Actix 框架构建的，但后来两者渐渐分离开来：

- Actix Web 现在是一个独立的 Web 框架，主打 HTTP 服务。
- Actix（不带 Web）是一个通用的 actor 系统，现在主要用于少量场景，比如 WebSocket 开发。

换句话说：除非你要写 WebSocket，一般项目用不到 Actix actor 框架。

## 适合哪些开发者:question:

无论你是：

- 已经会 Rust，想做 Web 后端；
- 会其他语言（如 Node.js、Python、Go）但想入门 Rust；
- 想构建快速、安全、可部署的微服务；

**Actix Web 都是一个值得尝试的选择！**

## Actix Web 会帮你做什么:question:

一个使用 Actix Web 构建的网站或服务，其实就是一个Rust 原生编译的可执行文件（.exe 或 Linux 可执行文件），它内置 HTTP
服务能力，可以直接运行：

```bash
$ cargo run
# 启动一个完整的网站服务
```

你可以选择：

- 把它放在 nginx 之后，用作反向代理；
- 或者直接部署这个程序，裸跑也完全没问题。

**Actix Web 是一个为 Rust 而生的现代 Web 框架，既快又安全，让你用最少的代码开发可上线的 Web 服务。**

## Actix Web 与其他主流 Web 框架对比

| 框架             | 所属语言       | 性能    | 并发支持       | 安全性    | 易用性     | 成熟度   | 适合项目类型           |
|----------------|------------|-------|------------|--------|---------|-------|------------------|
| **Actix Web**  | Rust       | 🚀 极高 | ✅ 强        | 🛡️ 极强 | 🧠 稍陡   | ⭐⭐⭐⭐  | 微服务、API、全栈网站     |
| **Express.js** | JavaScript | ⏩ 中等  | ☑️ 弱（单线程）  | 🟡 一般  | 🟢 极易上手 | ⭐⭐⭐⭐⭐ | Node 应用、前端配套 API |
| **Flask**      | Python     | 🐢 较慢 | ☑️ 中       | 🟡 一般  | 🟢 简单   | ⭐⭐⭐⭐⭐ | 原型开发、小型工具        |
| **FastAPI**    | Python     | ⚡ 中上  | ✅ 支持 async | 🟡 中等  | 🟢 友好   | ⭐⭐⭐⭐  | AI 接口、数据服务       |
| **Go Fiber**   | Go         | 🚀 极高 | ✅ 原生强并发    | 🛡️ 强  | 🟢 简单   | ⭐⭐⭐⭐  | API 服务、SaaS 后端   |
