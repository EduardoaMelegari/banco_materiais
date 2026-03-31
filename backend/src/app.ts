import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { budgetRoutes } from "./routes/budgetRoutes.js";
import { materialRoutes } from "./routes/materialRoutes.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    now: new Date().toISOString(),
  });
});

app.use("/api/materials", materialRoutes);
app.use("/api/budgets", budgetRoutes);

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    return response.status(400).json({
      message: "Dados inválidos.",
      issues: error.issues,
    });
  }

  if (error instanceof SyntaxError) {
    return response.status(400).json({ message: "JSON inválido." });
  }

  console.error(error);
  return response.status(500).json({
    message: "Erro interno do servidor.",
  });
});
