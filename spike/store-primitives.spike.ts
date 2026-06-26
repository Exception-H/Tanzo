import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase } from '../src/main/database/connection'
import { runMigrations } from '../src/main/database/migrations'
import { tanzoMigrations } from '../src/main/database/schema'
import { createAgentStore } from '../src/main/agent/store'
import type { AgentIdentity, Logger } from '../src/main/agent/types'
import type { TanzoUIMessage } from '../src/shared/agent'

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {}
} as unknown as Logger

const identity: AgentIdentity = {
  resolveAgentType: (name) => ({ id: name, name, systemPrompt: '', allowedTools: null }) as never,
  listAgentTypes: () => []
}

function freshStore() {
  const { db } = openDatabase({ databasePath: ':memory:' })
  runMigrations(db, [tanzoMigrations])
  return createAgentStore(db, identity, noopLogger, '/tmp')
}

function userMsg(id: string, text: string): TanzoUIMessage {
  return { id, role: 'user', parts: [{ type: 'text', text }] } as TanzoUIMessage
}

test('depthOf — root is 0, each parent hop adds 1', () => {
  const store = freshStore()
  const root = store.createConversation({ cwd: '/tmp' })
  const child = store.createConversation({ cwd: '/tmp', parentConversationId: root.id })
  const grandchild = store.createConversation({ cwd: '/tmp', parentConversationId: child.id })

  assert.equal(store.depthOf(root.id), 0)
  assert.equal(store.depthOf(child.id), 1)
  assert.equal(store.depthOf(grandchild.id), 2)
})

test('depthOf — unknown chatId is 0 (treated as root)', () => {
  const store = freshStore()
  assert.equal(store.depthOf('does-not-exist'), 0)
})

test('rootOf — walks to the parentless ancestor', () => {
  const store = freshStore()
  const root = store.createConversation({ cwd: '/tmp' })
  const child = store.createConversation({ cwd: '/tmp', parentConversationId: root.id })
  const grandchild = store.createConversation({ cwd: '/tmp', parentConversationId: child.id })

  assert.equal(store.rootOf(grandchild.id), root.id)
  assert.equal(store.rootOf(child.id), root.id)
  assert.equal(store.rootOf(root.id), root.id)
})

test('appendMessage — ord is monotonic across concurrent-style appends', async () => {
  const store = freshStore()
  const c = store.createConversation({ cwd: '/tmp' })

  await store.appendMessage(c.id, userMsg('m1', 'first'))
  await store.appendMessage(c.id, userMsg('m2', 'second'))
  const msgs = await store.load(c.id)

  assert.deepEqual(
    msgs.map((m) => m.id),
    ['m1', 'm2']
  )
})

test('appendMessage — derives title from first message only', async () => {
  const store = freshStore()
  const c = store.createConversation({ cwd: '/tmp' })
  assert.equal(c.title, '')

  await store.appendMessage(c.id, userMsg('m1', 'hello world'))
  assert.equal(store.getConversation(c.id)?.title, 'hello world')

  await store.appendMessage(c.id, userMsg('m2', 'second message'))
  assert.equal(store.getConversation(c.id)?.title, 'hello world')
})
