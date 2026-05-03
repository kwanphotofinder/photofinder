import { defineConfig } from 'prisma/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/facesearch'
const directConnectionString = process.env.DIRECT_URL || connectionString

export default defineConfig({
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
