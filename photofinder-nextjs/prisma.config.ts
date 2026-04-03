import { defineConfig } from 'prisma/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/facesearch'
const directConnectionString = process.env.DIRECT_URL || connectionString

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  datasource: {
    url: directConnectionString,
  },
  migrate: {
    async adapter() {
      const pool = new Pool({ connectionString: directConnectionString })
      return new PrismaPg(pool)
    },
  },
})
