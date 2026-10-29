# dsh-plugin-alias

给 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 的「插件」页加一个「别名」标签页：
为已安装的插件设置一个好记的别名，保存后卡片标题显示为 **别名（原包名）**。

例如：`记忆进化（dsh-memory-evolve）`

## 功能

- 通过官方扩展点 `plugins.tab` 在插件页新增「别名」标签页，用来编辑别名；
- 通过监听 `li[data-plugin-package]` 卡片节点，就地把标题文本改成「别名（原包名）」；
- 别名保存在浏览器 `localStorage`（键：`dsh-plugin-alias:aliases`），不写 profile、不改插件包；
- 卸载本插件后，标题立即恢复原样。

## 安装

在 DSH 会话里执行：

```text
plugin_manager(action: "install_bundle", target: "github:doudoudouhuahua/dsh-plugin-alias")
```

或者在 desktop profile 里手动安装（`link:` + `dsh.profile.bundles`）后重启 DSH。

安装后刷新页面（Ctrl+R）；若顶部没出现「别名」标签，则完全退出 DSH 再重新打开。

## 使用

1. 打开侧栏「插件」页；
2. 点「别名」标签；
3. 如果列表是空的，先切回「已安装」标签停留一两秒（插件名会自动收录），
   或在下方的「手动添加」里直接输入包名；
4. 在对应行输入别名（回车或失焦即保存，「清除」恢复原名）；
5. 切回「已安装」标签，卡片标题即变为「别名（原包名）」。

## 目录结构

| 文件 | 作用 |
| --- | --- |
| `package.json` | 包清单：`dsh.bundle.patch` + `dsh.client`（web 平台） |
| `cordis.patch.yml` | bundle patch：向 profile 插入 `dsh-plugin-alias` 这一行 |
| `lib/index.js` | 主机端空壳（功能全在浏览器端，此行只为让包成为可加载 bundle） |
| `lib/client.js` | 浏览器端：注册「别名」标签页 + 改写卡片标题 |
| `tests/headless-client.test.cjs` | 无浏览器的逻辑自测（Node 直接运行） |

## 自测

```powershell
node tests/headless-client.test.cjs
```

用 Node 24 运行；校验别名渲染、幂等、改名、清除恢复、收录、不误伤其他文本等 9 项。

## 限制与注意

- 只改写「卡片标题」，不改变插件本身、不影响插件功能；
- 只对标题显示为「原包名」的插件生效；若某插件自带本地化标题，标题文本不含包名，则不会被改写；
- 采用页面层改写，DSH 大版本改版导致卡片 DOM 结构变化时可能需要维护；
- 别名是本机浏览器级配置，不随 profile 同步到其他机器；
- DSH 升级会保留本插件（它以 `link:` 方式安装在 profile 依赖里，升级后需确认仍在）。

## 卸载

从 profile 的 `package.json` 删除依赖与 bundles 项，重启 DSH；页面标题恢复原名，别名配置留在 `localStorage` 中（可忽略）。

## License

[MIT](LICENSE)
