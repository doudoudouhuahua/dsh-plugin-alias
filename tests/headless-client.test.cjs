// Headless check for dsh-plugin-alias client half: stubs the module loader, DOM,
// localStorage and React so the title patcher can be exercised without a browser.
const path = require('node:path')

const store = new Map()
const cards = []

function makeCard(name, titleText) {
  const parent = { children: [] }
  const node = { nodeValue: titleText, parentElement: parent }
  const li = {
    _nodes: [node],
    getAttribute: (attr) => (attr === 'data-plugin-package' ? name : null),
  }
  return { li, node }
}

let pending = []
const window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
  },
  setTimeout: (fn) => { pending.push(fn); return pending.length },
  clearTimeout: () => {},
  __ModuleLoader__: {
    load: ({ id, factory }) => {
      loaded.id = id
      loaded.exports = factory(fakeRequire)
    },
  },
}
const loaded = { id: null, exports: null }

const fakeReact = {
  createElement: () => null,
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useMemo: (fn) => fn(),
}
const fakeRequire = (name) => {
  if (name === 'react') return fakeReact
  throw new Error('unexpected require: ' + name)
}

const document = {
  body: {},
  querySelectorAll: (selector) => (selector === 'li[data-plugin-package]' ? cards.map((c) => c.li) : []),
  createTreeWalker: (li) => {
    let index = -1
    return {
      nextNode: () => {
        index += 1
        return index < li._nodes.length ? li._nodes[index] : null
      },
    }
  },
}

global.window = window
global.document = document
global.navigator = { language: 'zh-CN' }
global.localStorage = window.localStorage

require(path.join(__dirname, '..', 'lib', 'client.js'))

const assert = require('node:assert')
const failures = []
function check(name, fn) {
  try {
    fn()
    console.log('PASS', name)
  } catch (error) {
    failures.push(name + ': ' + error.message)
    console.log('FAIL', name, '-', error.message)
  }
}

check('module loads with the expected id', () => {
  assert.strictEqual(loaded.id, 'dsh-plugin-alias')
  assert.strictEqual(loaded.exports.name, 'dsh-plugin-alias')
  assert.deepStrictEqual(loaded.exports.inject, ['slots'])
  assert.strictEqual(typeof loaded.exports.apply, 'function')
})

let tabRegistration = null
const ctx = {
  effect: (fn) => { const dispose = fn(); if (typeof dispose === 'function') disposers.push(dispose) },
  slots: {
    inject: (slot, callback) => {
      tabRegistration = { slot, result: callback() }
    },
    register: (options, renderer) => ({ options, renderer }),
  },
}
const disposers = []
check('apply registers the alias tab', () => {
  loaded.exports.apply(ctx)
  assert.ok(tabRegistration, 'slots.inject was not called')
  assert.strictEqual(tabRegistration.slot, 'plugins.tab')
  assert.strictEqual(tabRegistration.result.options.id, 'plugin-alias')
  assert.strictEqual(tabRegistration.result.options.label(), '别名')
  assert.strictEqual(typeof tabRegistration.result.renderer, 'function')
})

const debug = window.__DSH_PLUGIN_ALIAS__

check('no alias keeps the package name', () => {
  const card = makeCard('dsh-memory-evolve', 'dsh-memory-evolve')
  cards.length = 0
  cards.push(card)
  debug.applyTitles()
  assert.strictEqual(card.node.nodeValue, 'dsh-memory-evolve')
})

check('alias is rendered before the package name in parentheses', () => {
  window.localStorage.setItem(debug.ALIAS_KEY, JSON.stringify({ 'dsh-memory-evolve': '记忆进化' }))
  const card = cards[0]
  debug.applyTitles()
  assert.strictEqual(card.node.nodeValue, '记忆进化（dsh-memory-evolve）')
})

check('second pass is idempotent', () => {
  const card = cards[0]
  debug.applyTitles()
  assert.strictEqual(card.node.nodeValue, '记忆进化（dsh-memory-evolve）')
})

check('changing the alias rewrites the title', () => {
  window.localStorage.setItem(debug.ALIAS_KEY, JSON.stringify({ 'dsh-memory-evolve': '记性' }))
  const card = cards[0]
  debug.applyTitles()
  assert.strictEqual(card.node.nodeValue, '记性（dsh-memory-evolve）')
})

check('clearing the alias restores the package name', () => {
  window.localStorage.setItem(debug.ALIAS_KEY, JSON.stringify({}))
  const card = cards[0]
  debug.applyTitles()
  assert.strictEqual(card.node.nodeValue, 'dsh-memory-evolve')
})

check('discovered packages are remembered', () => {
  const card = makeCard('dsh-task-notify', 'dsh-task-notify')
  cards.push(card)
  debug.applyTitles()
  const seen = debug.readSeen()
  assert.ok(seen.includes('dsh-memory-evolve'), 'memory-evolve missing from seen: ' + JSON.stringify(seen))
  assert.ok(seen.includes('dsh-task-notify'), 'task-notify missing from seen: ' + JSON.stringify(seen))
})

check('unrelated text is untouched', () => {
  const other = makeCard('other-plugin', 'other-plugin')
  cards.length = 0
  cards.push(other)
  window.localStorage.setItem(debug.ALIAS_KEY, JSON.stringify({ 'dsh-memory-evolve': '记忆进化' }))
  debug.applyTitles()
  assert.strictEqual(other.node.nodeValue, 'other-plugin')
})

if (failures.length > 0) {
  console.error('\n' + failures.length + ' failure(s)')
  process.exit(1)
}
console.log('\nall checks passed')
