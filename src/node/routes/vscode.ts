import * as express from "express"
import { Server } from "http"
import { AuthType, DefaultedArgs } from "../cli"
import { version as codeServerVersion } from "../constants"
import { ensureAuthenticated } from "../http"
import { loadAMDModule } from "../util"
import { Router as WsRouter, WebsocketRouter } from "../wsRouter"

export interface VSServerResult {
  router: express.Router
  wsRouter: WebsocketRouter
  vscodeServer: Server
}

export const createVSServerRouter = async (args: DefaultedArgs): Promise<VSServerResult> => {
  const vscodeServerMain = await loadAMDModule<CodeServerLib.CreateVSServer>("vs/server/entry", "createVSServer")

  const serverUrl = new URL(`${args.cert ? "https" : "http"}://${args.host}:${args.port}`)
  const vscodeServer = await vscodeServerMain({
    codeServerVersion,
    serverUrl,
    args,
    authed: args.auth !== AuthType.None,
    disableUpdateCheck: !!args["disable-update-check"],
  })

  const router = express.Router()
  const wsRouter = WsRouter()

  router.all("*", ensureAuthenticated, (req, res) => {
    vscodeServer.emit("request", req, res)
  })

  wsRouter.ws("/", ensureAuthenticated, (req) => {
    vscodeServer.emit("upgrade", req, req.socket, req.head)

    req.socket.resume()
  })

  return {
    router,
    wsRouter,
    vscodeServer,
  }
}
