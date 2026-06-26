# React Router + 三页面设计

## 概述

为现有的 Vite + React 19 + TypeScript 项目添加基于 React Router v7 的客户端路由，创建三个页面：Playground、Projects（项目列表）、Canvas（项目详情/画布）。

## 路由表

| 路径 | 页面组件 | 说明 |
|---|---|---|
| `/` | — | `Navigate` 重定向到 `/projects` |
| `/playground` | Playground | 实验/创作空间 |
| `/projects` | Projects | 项目列表概览 |
| `/projects/:id` | Canvas | 画布（项目详情） |
| `*` | NotFound | 404 兜底 |

## 组件架构

```
<BrowserRouter>
  <Routes>
    <Route element={<Layout />}>       ← 公共导航栏 + <Outlet />
      <Route index element={<Navigate to="/projects" />} />
      <Route path="playground" element={lazy(Playground)} />
      <Route path="projects" element={lazy(Projects)} />
      <Route path="projects/:id" element={lazy(Canvas)} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
</BrowserRouter>
```

### Layout 组件

- 顶部导航栏，含 Logo 和两个导航链接：Playground、Projects
- 使用 `NavLink` 实现当前页高亮
- `<Outlet />` 渲染子路由内容

### 页面组件（初始占位态）

- **Playground** — 标题 + 空白实验区域
- **Projects** — 项目卡片列表（静态占位数据）
- **Canvas** — 通过 `useParams()` 获取 `:id`，显示"项目 #ID"信息
- **NotFound** — 404 提示

## 技术选型

- `react-router-dom` v7（BrowserRouter 模式）
- `React.lazy()` + `<Suspense>` 实现页面懒加载
- 无额外 UI 库依赖

## 文件结构

```
src/
├── pages/
│   ├── Layout.tsx
│   ├── Playground.tsx
│   ├── Projects.tsx
│   ├── Canvas.tsx
│   └── NotFound.tsx
├── App.tsx          ← 路由配置
└── main.tsx         ← 不变（仅添加 BrowserRouter）
```
