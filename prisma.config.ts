import path from 'path'
import { defineConfig } from 'prisma/config'
import { PrismaPg } from '@prisma/adapter-pg'

function loadEnvLocal() {
  const fs = require('fs')
  try {
    const content = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8')
    content.split('\n').forEach((line: string) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) return
      const key = trimmed.slice(0, eqIdx).trim()
      let val = trimmed.slice(eqIdx + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      if (!process.env[key]) process.env[key] = val
    })
  } catch {}
}
loadEnvLocal()

const connectionString = process.env.DATABASE_URL!

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  migrate: {
    adapter: () => new PrismaPg({ connectionString }),
  },
})
