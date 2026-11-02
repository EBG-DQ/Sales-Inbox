import express from "express";
import cors from "cors";
import { inngestHandler } from "./inngest";
import { leadsRouter } from "./routes/leads";

const app = express();
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
  }),
);
app.use(express.json());
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/leads", leadsRouter);
app.use("/api/inngest", inngestHandler);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
