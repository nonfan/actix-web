# 自动重新加载开发服务器

在开发过程中，让 `cargo` 在更改时自动重新编译代码非常方便。这可以通过使用 `watchexec` 非常容易地完成。

:::code-group

```bash [macOS]
brew install watchexec
```

```bash [使用 cargo]
cargo install watchexec-cli
```

:::

安装好后，运行：如果输出版本号就说明安装成功。

```bash
watchexec --version
```

以下命令在每次当前目录（包括子目录）内具有 rs 扩展名的文件发生更改时运行/重新启动 `cargo run`：

```bash
watchexec -e rs -r cargo run
```

如果要查看特定目录中的所有文件，可以使用 `-w` 参数：

```bash
watchexec -w src -r cargo run
```

