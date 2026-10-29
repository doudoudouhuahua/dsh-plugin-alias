/**
 * Browser half of dsh-plugin-alias.
 *
 * Adds a「别名」tab to the Plugins page and rewrites installed-bundle card
 * titles to「别名（原包名）」. Zero core modification: the tab rides the documented
 * `plugins.tab` slot, and titles are patched in place on the DOM nodes the
 * plugin manager already renders (`li[data-plugin-package]`). Aliases live in
 * localStorage, so they survive restarts and never touch the profile.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-alias',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const ALIAS_KEY = 'dsh-plugin-alias:aliases'
    const SEEN_KEY = 'dsh-plugin-alias:seen'
    const MAX_SEEN = 300

    /** True when the interface language is Chinese. */
    function isZh() {
      try {
        return String(navigator.language || 'zh').toLowerCase().indexOf('zh') === 0
      } catch {
        return true
      }
    }

    const T = {
      tabLabel: () => (isZh() ? '别名' : 'Aliases'),
      heading: () => (isZh() ? '插件别名' : 'Plugin aliases'),
      hint: () => (isZh()
        ? '给已安装的插件起一个好记的名字。保存后，卡片标题会显示成「别名（原包名）」，原包名保留在括号里。'
        : 'Give installed plugins a memorable name. Cards show "Alias (package name)" — the real package name stays in parentheses.'),
      empty: () => (isZh()
        ? '还没有发现插件。先切到「已安装」标签页停留一下，列表会自动收录；也可以在下面手动添加包名。'
        : 'No plugins discovered yet. Open the “Installed” tab for a moment so the list can be collected, or add a package name below.'),
      placeholder: () => (isZh() ? '例如：记忆进化' : 'e.g. Memory'),
      clear: () => (isZh() ? '清除' : 'Clear'),
      addHeading: () => (isZh() ? '手动添加' : 'Add manually'),
      addPlaceholder: () => (isZh() ? '包名，如 dsh-memory-evolve' : 'Package name, e.g. dsh-memory-evolve'),
      add: () => (isZh() ? '添加' : 'Add'),
      backHint: () => (isZh()
        ? '编辑会自动保存。切回「已安装」标签页即可看到效果；如果没有变化，刷新一下插件列表。'
        : 'Edits save automatically. Switch back to “Installed” to see the result; refresh the plugin list if it looks stale.'),
      exampleHeading: () => (isZh() ? '说明' : 'Notes'),
      exampleBody: () => (isZh()
        ? '只改写卡片标题，不修改插件本身；卸载本插件后别名立即消失，插件列表恢复原样。'
        : 'Only the card title is rewritten; the plugin itself is untouched. Uninstalling this plugin restores the original titles immediately.'),
    }

    function readJson(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key)
        if (raw === null || raw === '') return fallback
        const value = JSON.parse(raw)
        return value === null || typeof value !== 'object' ? fallback : value
      } catch {
        return fallback
      }
    }

    function writeJson(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Storage may be unavailable (private mode); the feature then degrades to a no-op.
      }
    }

    function readAliases() {
      return readJson(ALIAS_KEY, {})
    }

    function readSeen() {
      const value = readJson(SEEN_KEY, [])
      return Array.isArray(value) ? value.filter(name => typeof name === 'string' && name !== '') : []
    }

    function rememberSeen(names) {
      if (names.length === 0) return
      const seen = readSeen()
      const set = new Set(seen)
      let changed = false
      for (const name of names) {
        if (!set.has(name)) {
          set.add(name)
          changed = true
        }
      }
      if (!changed) return
      writeJson(SEEN_KEY, Array.from(set).slice(0, MAX_SEEN))
    }

    /** The title text a card should show for this package. */
    function titleFor(alias, name) {
      return alias === '' ? name : alias + '（' + name + '）'
    }

    /**
     * The text node that renders the card title: the first leaf text equal to the
     * package name or to a previously applied「别名（包名）」.
     */
    function findTitleNode(li, name) {
      if (typeof document.createTreeWalker !== 'function') return null
      const suffix = '（' + name + '）'
      const walker = document.createTreeWalker(li, 4 /* NodeFilter.SHOW_TEXT */)
      let node = walker.nextNode()
      while (node !== null) {
        const parent = node.parentElement
        const text = String(node.nodeValue === null ? '' : node.nodeValue).trim()
        if (parent !== null && parent.children.length === 0 && (text === name || text.endsWith(suffix) === true)) return node
        node = walker.nextNode()
      }
      return null
    }

    /** Rewrite card titles in place. Cheap enough to run on every mutation burst. */
    function applyTitles() {
      const cards = document.querySelectorAll('li[data-plugin-package]')
      if (cards.length === 0) return 0
      const aliases = readAliases()
      const discovered = []
      let patched = 0
      for (const li of cards) {
        const name = li.getAttribute('data-plugin-package')
        if (name === null || name === '') continue
        discovered.push(name)
        const raw = aliases[name]
        const alias = typeof raw === 'string' ? raw.trim() : ''
        const want = titleFor(alias, name)
        const node = findTitleNode(li, name)
        const current = node === null ? '' : String(node.nodeValue === null ? '' : node.nodeValue).trim()
        if (node !== null && current !== want) {
          node.nodeValue = want
          patched += 1
        }
      }
      rememberSeen(discovered)
      return patched
    }

    let timer = 0
    function schedule() {
      if (timer !== 0) return
      timer = window.setTimeout(() => {
        timer = 0
        try {
          applyTitles()
        } catch (error) {
          console.error('[dsh-plugin-alias] title patch failed:', error)
        }
      }, 120)
    }

    const boxStyle = {
      padding: '18px 20px',
      color: 'var(--dsw-alias-label-primary)',
      fontSize: '13px',
      lineHeight: '20px',
    }
    const headingStyle = {
      margin: '0 0 6px',
      fontSize: '14px',
      fontWeight: 600,
    }
    const hintStyle = {
      margin: '0 0 16px',
      color: 'var(--dsw-alias-label-secondary)',
    }
    const rowStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      margin: '0 0 8px',
    }
    const nameStyle = {
      flex: '0 0 auto',
      maxWidth: '260px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      color: 'var(--dsw-alias-label-secondary)',
      fontFamily: 'var(--dsw-font-mono, ui-monospace, monospace)',
      fontSize: '12px',
    }
    const inputStyle = {
      flex: '1 1 auto',
      minWidth: '120px',
      height: '28px',
      padding: '0 8px',
      borderRadius: '6px',
      border: '1px solid var(--dsw-alias-border-l2)',
      background: 'transparent',
      color: 'inherit',
      fontSize: '13px',
      outline: 'none',
    }
    const buttonStyle = {
      flex: '0 0 auto',
      height: '28px',
      padding: '0 10px',
      borderRadius: '6px',
      border: '1px solid var(--dsw-alias-border-l2)',
      background: 'transparent',
      color: 'var(--dsw-alias-label-secondary)',
      fontSize: '12px',
      cursor: 'pointer',
    }

    /** The「别名」tab: one editable alias per discovered package. */
    function AliasTab() {
      const [aliases, setAliases] = React.useState(readAliases)
      const [seen, setSeen] = React.useState(readSeen)
      const [draft, setDraft] = React.useState('')

      const names = React.useMemo(() => {
        const all = new Set(seen)
        for (const name of Object.keys(aliases)) all.add(name)
        return Array.from(all).sort()
      }, [aliases, seen])

      const save = (name, value) => {
        const next = Object.assign({}, aliases)
        const trimmed = value.trim()
        if (trimmed === '') delete next[name]
        else next[name] = trimmed
        setAliases(next)
        writeJson(ALIAS_KEY, next)
        // Apply right away when the installed list happens to be mounted.
        applyTitles()
      }

      const add = () => {
        const name = draft.trim()
        if (name === '') return
        const next = Array.from(new Set(readSeen().concat([name])))
        writeJson(SEEN_KEY, next.slice(0, MAX_SEEN))
        setSeen(next)
        setDraft('')
      }

      return h('div', { style: boxStyle }, [
        h('h3', { key: 'heading', style: headingStyle }, T.heading()),
        h('p', { key: 'hint', style: hintStyle }, T.hint()),
        names.length === 0 ? h('p', { key: 'empty', style: hintStyle }, T.empty()) : null,
        names.map(name => h('div', { key: name, style: rowStyle }, [
          h('span', { key: 'name', style: nameStyle, title: name }, name),
          h('input', {
            key: 'input',
            style: inputStyle,
            value: aliases[name] === undefined ? '' : aliases[name],
            placeholder: T.placeholder(),
            onChange: (event) => {
              const value = event.target.value
              const next = Object.assign({}, aliases)
              if (value.trim() === '') delete next[name]
              else next[name] = value
              setAliases(next)
              writeJson(ALIAS_KEY, next)
            },
            onBlur: (event) => { save(name, event.target.value) },
            onKeyDown: (event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                save(name, event.target.value)
                event.target.blur()
              }
            },
          }),
          h('button', {
            key: 'clear',
            type: 'button',
            style: buttonStyle,
            onClick: () => save(name, ''),
          }, T.clear()),
        ])),
        h('h3', { key: 'addHeading', style: Object.assign({}, headingStyle, { marginTop: '18px' }) }, T.addHeading()),
        h('div', { key: 'addRow', style: rowStyle }, [
          h('input', {
            key: 'addInput',
            style: inputStyle,
            value: draft,
            placeholder: T.addPlaceholder(),
            onChange: (event) => { setDraft(event.target.value) },
            onKeyDown: (event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                add()
              }
            },
          }),
          h('button', { key: 'addButton', type: 'button', style: buttonStyle, onClick: add }, T.add()),
        ]),
        h('p', { key: 'backHint', style: Object.assign({}, hintStyle, { marginTop: '16px' }) }, T.backHint()),
        h('h3', { key: 'exampleHeading', style: Object.assign({}, headingStyle, { marginTop: '18px' }) }, T.exampleHeading()),
        h('p', { key: 'exampleBody', style: Object.assign({}, hintStyle, { marginBottom: '0' }) }, T.exampleBody()),
      ])
    }

    function apply(ctx) {
      // A failure here must never take the whole client module down: the plugin is
      // cosmetic, so any incompatibility degrades to a no-op.
      try {
        ctx.effect(() => {
          if (typeof MutationObserver !== 'function') return () => {}
          const observer = new MutationObserver(() => { schedule() })
          observer.observe(document.body, { childList: true, subtree: true, characterData: true })
          schedule()
          return () => {
            observer.disconnect()
            if (timer !== 0) {
              window.clearTimeout(timer)
              timer = 0
            }
          }
        }, 'dsh-plugin-alias: card titles')

        ctx.slots.inject('plugins.tab', () => ctx.slots.register({
          name: 'plugins.tab',
          id: 'plugin-alias',
          order: 40,
          label: () => T.tabLabel(),
        }, AliasTab))
      } catch (error) {
        console.error('[dsh-plugin-alias] apply failed:', error)
      }

      // Debug handle: lets a console or a test drive the patcher directly.
      try {
        window.__DSH_PLUGIN_ALIAS__ = {
          version: '0.1.0',
          applyTitles,
          readAliases,
          readSeen,
          ALIAS_KEY,
          SEEN_KEY,
        }
      } catch {
        // A frozen global scope is not worth failing the plugin over.
      }
    }

    const module = { exports: {} }
    module.exports = {
      name: 'dsh-plugin-alias',
      inject: ['slots'],
      apply,
    }
    return module.exports
  },
})
