/**
 * Bug Condition Exploration Test
 *
 * Property 1: Bug Condition — No Starknet Strings in i18n and Rendered Output
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 *
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists. DO NOT fix the code to make this pass.
 */

import { describe, it, expect } from 'vitest'
import enJson from '../locales/en.json'
import esJson from '../locales/es.json'
import { explorerUrl } from '../utils/explorerUrl'

/** Recursively collect all leaf string values from a nested JSON object */
function collectLeafStrings(obj: unknown, path = ''): Array<{ path: string; value: string }> {
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

/** isBugCondition: returns true when value contains "starknet" (case-insensitive) */
function isBugCondition(value: string): boolean {
  return value.toLowerCase().includes('starknet')
}

describe('Bug Condition Exploration — Property 1: No Starknet strings', () => {
  describe('en.json locale values', () => {
    const enLeaves = collectLeafStrings(enJson)

    it('should have no leaf values containing "starknet" (case-insensitive)', () => {
      const violations = enLeaves.filter(({ value }) => isBugCondition(value))
      if (violations.length > 0) {
        const details = violations.map(({ path, value }) => `  en.json ${path} = "${value}"`).join('\n')
        throw new Error(`Bug condition found in en.json — ${violations.length} violation(s):\n${details}`)
      }
      expect(violations).toHaveLength(0)
    })
  })

  describe('es.json locale values', () => {
    const esLeaves = collectLeafStrings(esJson)

    it('should have no leaf values containing "starknet" (case-insensitive)', () => {
      const violations = esLeaves.filter(({ value }) => isBugCondition(value))
      if (violations.length > 0) {
        const details = violations.map(({ path, value }) => `  es.json ${path} = "${value}"`).join('\n')
        throw new Error(`Bug condition found in es.json — ${violations.length} violation(s):\n${details}`)
      }
      expect(violations).toHaveLength(0)
    })
  })

  describe('explorerUrl helper', () => {
    it('should not return a URL containing "starknet", "voyager", or "starkscan"', () => {
      const url = explorerUrl('abc123', 'tx')
      const lower = url.toLowerCase()
      const hasBug = lower.includes('starknet') || lower.includes('voyager') || lower.includes('starkscan')
      if (hasBug) {
        throw new Error(`Bug condition found in explorerUrl("abc123", "tx") = "${url}" — contains Starknet explorer reference`)
      }
      expect(hasBug).toBe(false)
    })

    it('should not return an account URL containing "starknet", "voyager", or "starkscan"', () => {
      const url = explorerUrl('abc123', 'account')
      const lower = url.toLowerCase()
      const hasBug = lower.includes('starknet') || lower.includes('voyager') || lower.includes('starkscan')
      if (hasBug) {
        throw new Error(`Bug condition found in explorerUrl("abc123", "account") = "${url}" — contains Starknet explorer reference`)
      }
      expect(hasBug).toBe(false)
    })
  })
})
