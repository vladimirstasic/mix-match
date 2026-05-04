import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { config } from "./config.js";
import { uploadRouter } from "./routes/upload.js";
import { analysisRouter } from "./routes/analysis.js";
import { retryRouter } from "./routes/retry.js";
import { userRouter } from "./routes/user.js";
import { spotifyRouter } from "./routes/spotify.js";
import { communityRouter } from "./routes/community.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(clerkMiddleware());
app.use("/api", uploadRouter);
app.use("/api", analysisRouter);
app.use("/api", retryRouter);
app.use("/api", userRouter);
app.use("/api", spotifyRouter);
app.use("/api", communityRouter);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`API server running on port ${config.port}`);
});
