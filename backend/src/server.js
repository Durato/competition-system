import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import teamRoutes from "./routes/team.routes.js";
import robotRoutes from "./routes/robot.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import paymentRoutes from "./routes/payment.routes.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.use("/auth", authRoutes);
app.use("/teams", teamRoutes);
app.use("/robots", robotRoutes);
app.use("/categories", categoryRoutes);
app.use("/payments", paymentRoutes);

app.listen(3000, () => console.log("Servidor rodando na porta 3000"));
