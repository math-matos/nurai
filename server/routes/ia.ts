import { Hono } from 'hono'
import type { Deps } from '../app.js'

export function rotasIa(_deps: Deps): Hono {
  return new Hono()
}
