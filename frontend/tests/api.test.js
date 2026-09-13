import assert from 'node:assert/strict'
import { test } from 'node:test'
import { api, onSessionChange, today } from '../src/api.js'

function reply(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

test('expired CSRF refreshes the session and safely retries exactly once', async () => {
  const original = globalThis.fetch
  const calls = []
  const changes = []
  const unsubscribe = onSessionChange((session) => changes.push(session))
  const responses = [
    reply(200, { csrf_token: 'initial-token', user: { id: 1 } }),
    reply(403, { code: 'csrf_expired', error: 'Expired' }),
    reply(200, { csrf_token: 'renewed-token', user: { id: 1 } }),
    reply(200, { message: 'Saved' }),
  ]
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options })
    return responses.shift()
  }
  try {
    await api('/auth/session')
    assert.equal((await api('/me', { method: 'PUT', body: { name: 'Test' } })).message, 'Saved')
    assert.equal(calls.length, 4)
    assert.equal(calls[3].options.headers['X-CSRF-Token'], 'renewed-token')
    assert.equal(changes.length, 2)
    assert.equal(calls[1].options.body, calls[3].options.body)
  } finally {
    globalThis.fetch = original
    unsubscribe()
  }
})

test('a second CSRF failure is reported without infinite retries', async () => {
  const original = globalThis.fetch
  const responses = [
    reply(403, { code: 'csrf_expired', error: 'Expired' }),
    reply(200, { csrf_token: 'new-token', user: null }),
    reply(403, { code: 'csrf_expired', error: 'Expired again' }),
  ]
  globalThis.fetch = async () => responses.shift()
  try {
    await assert.rejects(api('/auth/logout', { method: 'POST' }), /Expired again/)
    assert.equal(responses.length, 0)
  } finally {
    globalThis.fetch = original
  }
})

test('unauthorized protected requests clear local authentication', async () => {
  const original = globalThis.fetch
  const changes = []
  const unsubscribe = onSessionChange((session) => changes.push(session))
  globalThis.fetch = async () => reply(401, { error: 'Please log in' })
  try {
    await assert.rejects(api('/me/dashboard'), /Please log in/)
    assert.deepEqual(changes, [{ user: null }])
    await assert.rejects(api('/auth/login'), /Please log in/)
    assert.equal(changes.length, 1)
  } finally {
    globalThis.fetch = original
    unsubscribe()
  }
})

test('date input default has an ISO calendar date shape', () => {
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/)
})
