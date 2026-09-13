import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accountHome, loginDestination } from '../src/auth-routing.js'

test('each role reaches its own interface after login', () => {
  assert.equal(accountHome({ role: 'admin' }), '/quan-tri')
  assert.equal(accountHome({ role: 'trainer' }), '/hlv')
  assert.equal(accountHome({ role: 'member' }), '/hoi-vien')
})

test('member login cannot redirect into the admin or trainer interface', () => {
  assert.equal(loginDestination({ role: 'member' }, '/quan-tri?tab=users'), '/hoi-vien')
  assert.equal(loginDestination({ role: 'member' }, '/hlv'), '/hoi-vien')
  assert.equal(loginDestination({ role: 'trainer' }, '/quan-tri'), '/hlv')
  assert.equal(loginDestination({ role: 'admin' }, '/quan-tri?tab=plans'), '/quan-tri?tab=plans')
})

test('login redirect retains booking destinations and rejects external URLs and loops', () => {
  const member = { role: 'member' }
  assert.equal(loginDestination(member, '/goi-tap?plan=1'), '/goi-tap?plan=1')
  for (const from of ['https://example.com', '//example.com', '/\\example.com', '/dang-nhap', '/quan-tri/dang-nhap', null]) {
    assert.equal(loginDestination(member, from), '/hoi-vien')
  }
})
