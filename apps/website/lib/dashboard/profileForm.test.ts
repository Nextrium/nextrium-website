import { test } from 'node:test'
import assert from 'node:assert/strict'
import { profileHasChanges, type ProfileValues } from './profileForm'

const saved: ProfileValues = {
  bio: 'I build things',
  handles: { github: '@me', twitter: '' },
  contributor: { displayName: 'Me', categories: ['design', 'technical'], skillsText: 'React, Figma', availability: '5', notifyEmail: true },
}

test('no changes when nothing differs', () => {
  assert.equal(profileHasChanges(saved, structuredClone(saved)), false)
})

test('whitespace, empty handles and ordering are not changes', () => {
  assert.equal(profileHasChanges(saved, {
    bio: '  I build things ',
    handles: { twitter: '  ', github: ' @me ' },
    contributor: { displayName: ' Me', categories: ['technical', 'design'], skillsText: 'React ,  Figma,', availability: ' 5 ', notifyEmail: true },
  }), false)
})

test('real edits are changes', () => {
  assert.equal(profileHasChanges(saved, { ...saved, bio: 'New bio' }), true)
  assert.equal(profileHasChanges(saved, { ...saved, handles: { github: '@other' } }), true)
  assert.equal(profileHasChanges(saved, { ...saved, contributor: { ...saved.contributor!, notifyEmail: false } }), true)
  assert.equal(profileHasChanges(saved, { ...saved, contributor: { ...saved.contributor!, categories: ['design'] } }), true)
  assert.equal(profileHasChanges(saved, { ...saved, contributor: { ...saved.contributor!, skillsText: 'React' } }), true)
})

test('profiles without contributor fields compare cleanly', () => {
  const plain: ProfileValues = { bio: '', handles: {}, contributor: null }
  assert.equal(profileHasChanges(plain, { bio: '', handles: {}, contributor: null }), false)
  assert.equal(profileHasChanges(plain, { bio: 'x', handles: {}, contributor: null }), true)
})
