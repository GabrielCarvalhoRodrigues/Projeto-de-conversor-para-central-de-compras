import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import fs from "node:fs";
import path from "node:path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// No Render, um único serviço pode atender a interface e a API.
// No Replit, os serviços continuam separados, como antes.
if (process.env.SERVE_FRONTEND === "true") {
  const publicDir = path.resolve(
    import.meta.dirname,
    "../../conversor-xls/dist/public",
  );
  const indexPath = path.join(publicDir, "index.html");

  if (!fs.existsSync(indexPath)) {
    throw new Error("Interface não compilada. Execute pnpm run build:render antes de iniciar.");
  }

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Endpoint não encontrado." });
  });
  app.use(express.static(publicDir));
  app.get("/{*page}", (req, res) => {
    if (path.extname(req.path)) {
      res.sendStatus(404);
      return;
    }
    res.sendFile(indexPath);
  });
}

export default app;
