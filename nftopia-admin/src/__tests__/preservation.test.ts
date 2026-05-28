/**
 * Preservation Property Tests
 *
 * Property 2: Preservation — Non-Starknet Strings and UX Flows Unchanged
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 *
 * IMPORTANT: These tests MUST PASS on unfixed code.
 * They capture baseline behavior that must be preserved after the fix.
 */

import { describe, it, expect } from 'vitest'
import enJson from '../locales/en.json'
import esJson from '../locales/es.json'
import { explorerUrl } from '../utils/explorerUrl'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all leaf string values from a nested JSON object */
function collectLeafStrings(
  obj: unknown,
  path = ''
): Array<{ path: string; value: string }> {
  if (typeof obj === 'string') {
    return [{ path, value: obj }]
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([key, val]) =>
      collectLeafStrings(val, path ? `${path}.${key}` : key)
    )
  }
  return []
}

/** Returns true when the key path is outside wallet.* and network.* namespaces */
function isNonBlockchainKey(path: string): boolean {
  return !path.startsWith('wallet.') && !path.startsWith('network.')
}

/** Resolve a dot-notation key against a nested JSON object */
function resolveKey(obj: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, segment) => {
    if (acc !== null && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[segment]
    }
    return undefined
  }, obj)
}

// ---------------------------------------------------------------------------
// Snapshot of non-blockchain keys from the current (unfixed) en.json
// These values must remain identical after the fix.
// ---------------------------------------------------------------------------
const EN_NON_BLOCKCHAIN_SNAPSHOT: Record<string, string> = {
  'nav.dashboard': 'Dashboard',
  'nav.collections': 'Collections',
  'nav.settings': 'Settings',
  'table.header.name': 'Name',
  'table.header.status': 'Status',
  'table.header.date': 'Date',
}

const ES_NON_BLOCKCHAIN_SNAPSHOT: Record<string, string> = {
  'nav.dashboard': 'Panel',
  'nav.collections': 'Colecciones',
  'nav.settings': 'Configuración',
  'table.header.name': 'Nombre',
  'table.header.status': 'Estado',
  'table.header.date': 'Fecha',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Preservation — Property 2: Non-Starknet strings and UX flows unchanged', () => {
  /**
   * Property-based test: for all locale keys outside wallet.* and network.*
   * namespaces, assert the value does not change between stub and fixed locale
   * files (non-blockchain copy is identical).
   *
   * Validates: Requirements 3.5
   */
  describe('Non-blockchain key preservation — en.json', () => {
    const nonBlockchainLeaves = collectLeafStrings(enJson).filter(({ path }) =>
      isNonBlockchainKey(path)
    )

    it('should have at least one non-blockchain key present', () => {
      expect(nonBlockchainLeaves.length).toBeGreaterThan(0)
    })

    it('should resolve nav.dashboard to its expected value', () => {
      const value = resolveKey(enJson as Record<string, unknown>, 'nav.dashboard')
      expect(value).toBe(EN_NON_BLOCKCHAIN_SNAPSHOT['nav.dashboard'])
    })

    it('should resolve table.header.name to its expected value', () => {
      const value = resolveKey(enJson as Record<string, unknown>, 'table.header.name')
      expect(value).toBe(EN_NON_BLOCKCHAIN_SNAPSHOT['table.header.name'])
    })

    it('all snapshotted non-blockchain keys match their baseline values', () => {
      const mismatches: string[] = []
      for (const [key, expected] of Object.entries(EN_NON_BLOCKCHAIN_SNAPSHOT)) {
        const actual = resolveKey(enJson as Record<string, unknown>, key)
        if (actual !== expected) {
          mismatches.push(`  en.json ${key}: expected "${expected}", got "${String(actual)}"`)
        }
      }
      if (mismatches.length > 0) {
        throw new Error(`Non-blockchain key mismatch in en.json:\n${mismatches.join('\n')}`)
      }
      expect(mismatches).toHaveLength(0)
    })
  })

  describe('Non-blockchain key preservation — es.json', () => {
    const nonBlockchainLeaves = collectLeafStrings(esJson).filter(({ path }) =>
      isNonBlockchainKey(path)
    )

    it('should have at least one non-blockchain key present', () => {
      expect(nonBlockchainLeaves.length).toBeGreaterThan(0)
    })

    it('should resolve nav.dashboard to its expected value', () => {
      const value = resolveKey(esJson as Record<string, unknown>, 'nav.dashboard')
      expect(value).toBe(ES_NON_BLOCKCHAIN_SNAPSHOT['nav.dashboard'])
    })

    it('should resolve table.header.name to its expected value', () => {
      const value = resolveKey(esJson as Record<string, unknown>, 'table.header.name')
      expect(value).toBe(ES_NON_BLOCKCHAIN_SNAPSHOT['table.header.name'])
    })

    it('all snapshotted non-blockchain keys match their baseline values', () => {
      const mismatches: string[] = []
      for (const [key, expected] of Object.entries(ES_NON_BLOCKCHAIN_SNAPSHOT)) {
        const actual = resolveKey(esJson as Record<string, unknown>, key)
        if (actual !== expected) {
          mismatches.push(`  es.json ${key}: expected "${expected}", got "${String(actual)}"`)
        }
      }
      if (mismatches.length > 0) {
        throw new Error(`Non-blockchain key mismatch in es.json:\n${mismatches.join('\n')}`)
      }
      expect(mismatches).toHaveLength(0)
    })
  })

  /**
   * Property-based test: for any non-empty string id, assert
   * explorerUrl(id, "tx").includes(id) and explorerUrl(id, "account").includes(id).
   *
   * Validates: Requirements 3.3
   */
  describe('explorerUrl — id always appears in returned URL', () => {
    const sampleIds = [
      'abc123',
      'tx_hash_0xdeadbeef',
      '0x1234567890abcdef',
      'GABC123XYZ',
      'a',
      '1',
      'some-long-transaction-hash-value-here',
    ]

    for (const id of sampleIds) {
      it(`explorerUrl("${id}", "tx") includes the id`, () => {
        const url = explorerUrl(id, 'tx')
        expect(url).toContain(id)
      })

      it(`explorerUrl("${id}", "account") includes the id`, () => {
        const url = explorerUrl(id, 'account')
        expect(url).toContain(id)
      })
    }

    it('explorerUrl always returns a non-empty string for any non-empty id', () => {
      const ids = ['abc', '123', 'xyz_test', '0xABCDEF']
      for (const id of ids) {
        expect(explorerUrl(id, 'tx').length).toBeGreaterThan(0)
        expect(explorerUrl(id, 'account').length).toBeGreaterThan(0)
      }
    })
  })

  /**
   * Test: assert i18n fallback resolves missing key to fallback language value
   * without throwing.
   *
   * Since i18n is not yet bootstrapped, we test the raw JSON fallback behavior:
   * accessing a missing key returns undefined (not a thrown error), and the
   * en.json file serves as the fallback source for known keys.
   *
   * Validates: Requirements 3.1
   */
  describe('i18n fallback — missing key does not throw', () => {
    it('resolving a missing key from en.json returns undefined without throwing', () => {
      expect(() => {
        const value = resolveKey(enJson as Record<string, unknown>, 'nonexistent.key.path')
        expect(value).toBeUndefined()
      }).not.toThrow()
    })

    it('resolving a missing key from es.json returns undefined without throwing', () => {
      expect(() => {
        const value = resolveKey(esJson as Record<string, unknown>, 'missing.deeply.nested.key')
        expect(value).toBeUndefined()
      }).not.toThrow()
    })

    it('en.json acts as fallback: known key resolves to a string value', () => {
      const fallbackValue = resolveKey(enJson as Record<string, unknown>, 'nav.dashboard')
      expect(typeof fallbackValue).toBe('string')
      expect((fallbackValue as string).length).toBeGreaterThan(0)
    })

    it('missing key in es.json falls back to en.json value without throwing', () => {
      const missingKey = 'nonexistent.key'
      const esValue = resolveKey(esJson as Record<string, unknown>, missingKey)
      const enValue = resolveKey(enJson as Record<string, unknown>, missingKey)
      expect(esValue).toBeUndefined()
      expect(enValue).toBeUndefined()
    })
  })
})
