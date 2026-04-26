import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { uploadRouter } from "./routes/upload.js";
import { analysisRouter } from "./routes/analysis.js";
import { retryRouter } from "./routes/retry.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", uploadRouter);
app.use("/api", analysisRouter);
app.use("/api", retryRouter);

app.listen(config.port, () => {
  console.log(`API server running on port ${config.port}`);
});
