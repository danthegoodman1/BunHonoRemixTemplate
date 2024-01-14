import * as dotenv from 'dotenv'
dotenv.config()

import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'

import { logger } from './logger/index'
import { broadcastDevReady } from "@remix-run/node"

import sourceMapSupport from "source-map-support"
sourceMapSupport.install()

// import * as build from "@remix-run/dev/server-build"
import * as build from "../build/index.js"
import { remix } from "remix-hono/handler"
import { cors } from 'hono/cors'

const listenPort = process.env.PORT || '8080'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_TOKEN: string
      DSN: string
    }
  }
}

const app = new Hono()
app.use(cors())
app.use("*", remix({ build: build as any, mode: process.env.NODE_ENV as any }))

// app.use((req, res, next) => {
//   const reqID = uuidv4()
//   req.id = reqID
//   next()
// })

// if (process.env.HTTP_LOG === "1") {
//   logger.debug("using HTTP logger")
//   app.use((req: any, res, next) => {
//     req.log.info({ req })
//     res.on("finish", () => req.log.info({ res }))
//     next()
//   })
// }

app.get('/hc', (c) => {
  return c.text("ok")
})

if (process.env.NODE_ENV === "development") {
  broadcastDevReady(build as any)
}
logger.info(`API listening on port ${listenPort}`)

export default {
  port: process.env.PORT || '8080',
  fetch: app.fetch
}
