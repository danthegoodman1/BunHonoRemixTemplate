import * as dotenv from "dotenv"
dotenv.config()

import { Hono } from "hono"
import { v4 as uuidv4 } from "uuid"

import { logger } from "./logger/index"
import { broadcastDevReady } from "@remix-run/node"

import sourceMapSupport from "source-map-support"
sourceMapSupport.install()

// import * as build from "@remix-run/dev/server-build"
import * as build from "../build/index.js"
import { remix } from "remix-hono/handler"
import { cors } from "hono/cors"
import { serveStatic } from "hono/bun"
import { Server } from "bun"

const listenPort = process.env.PORT || "8080"

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_TOKEN: string
      DSN: string
    }
  }
}

declare module "hono" {
  interface ContextVariableMap {
    requestID: string
  }
}

const app = new Hono<{
  Bindings: {
    server: Server
  }
}>()
app.use(cors())

app.use(async (c, next) => {
  c.set("requestID", uuidv4())
  await next()
})

if (process.env.HTTP_LOG === "1") {
  logger.debug("using HTTP logger")
  app.use(async (c, next) => {
    logger.info(
      {
        method: c.req.method,
        url: c.req.url,
        id: c.get("requestID"),
      },
      "http request"
    )
    await next()
    logger.info(
      {
        method: c.req.method,
        url: c.req.url,
        id: c.get("requestID"),
        status: c.res.status,
      },
      "http response"
    )
  })
}

app.get("/hc", (c) => {
  return c.text("ok")
})

app.get("/ws", async (c) => {
  if (!c.env.server.upgrade(c.req.raw, {
    data: 'im some data for association'
  })) {
    logger.error("failed to upgrade!")
  }
  return new Response() // have to return empty response so hono doesn't get mad
})

app.use("/build/*", serveStatic({ root: "./public" }))
app.use("*", remix({ build: build as any, mode: process.env.NODE_ENV as any }))

if (process.env.NODE_ENV === "development") {
  broadcastDevReady(build as any)
}
logger.info(`API listening on port ${listenPort}`)

const server = Bun.serve({
  port: process.env.PORT || "8080",
  fetch: (req: Request, server: Server) => {
    // if (server.upgrade(req, {
    //   data: 'im data'
    // })) {
    //   // handle authentication
    //   return
    // }
    return app.fetch(req, {
      server,
    })
  },
  websocket: {
    message(ws, msg) {
      console.log("got message", ws.data, msg)
      ws.send("hi")
    },
    open(ws) {
      console.log("websocket opened", ws.data)
    },
  },
})

const signals = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGTERM: 15,
}

let stopping = false

Object.keys(signals).forEach((signal) => {
  process.on(signal, async () => {
    if (stopping) {
      return
    }
    stopping = true
    logger.info(`Received signal ${signal}, shutting down...`)
    logger.info("exiting...")
    logger.flush() // pino actually fails to flush, even with awaiting on a callback
    server.stop()
    process.exit(0)
  })
})
