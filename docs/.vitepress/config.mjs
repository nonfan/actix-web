import {defineConfig} from 'vitepress'

export default defineConfig({
  lang: "zh",
  base: "/actix-web",
  title: "Actix Web 中文文档",
  description: "Actix Web 是一个功能强大、实用且速度极快的 Rust Web 框架",
  head: [['link', {rel: 'icon', href: '/actix-web/logo.png'}]],
  themeConfig: {
    logo: {
      light: "/logo.png",
      dark: "/logo-dark.png",
    },
    nav: [
      {text: '指南', link: '/guide/whatis'},
      {text: '官方文档', link: 'https://actix.rs/docs'}
    ],
    sidebar: [
      {
        text: '入门',
        items: [
          {text: '什么是 Actix Web', link: '/guide/whatis'},
          {text: '快速开始', link: '/guide/getting-started'},
        ]
      },
      {
        text: "基础用法",
        collapsed: false,
        items: [
          {text: 'App 应用程序', link: '/basics/application.md'},
        ]
      }
    ],
    outline: [2, 3],
    outlineTitle: "页面导航",
    lastUpdated: {
      text: '最后更新于',
    },
    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },
    darkModeSwitchLabel: '外观',
    returnToTopLabel: '返回顶部',
    sidebarMenuLabel: '菜单',
    search: {
      provider: 'local',
    },
    socialLinks: [
      {icon: 'github', link: 'https://github.com/nonfan/actix-web'}
    ],
    editLink: {
      pattern: 'https://github.com/nonfan/actix-web/edit/docs/docs/:path',
      text: "在 GitHub 上编辑此页面"
    },
    footer: {
      message: '基于 MIT 许可发布',
      copyright: 'Copyright © 2025-present <a href="https://github.com/nonfan">MOFAN</a>'
    },
  }
})
