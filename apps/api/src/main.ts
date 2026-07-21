import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule);
app.setGlobalPrefix("api");
app.enableCors({ origin: process.env.WEB_URL ?? "http://localhost:3000" });
app.getHttpAdapter().get("/health", (_request: unknown, response: { send: (body: unknown) => void }) => response.send({ status: "ok" }));

const port = Number(process.env.PORT ?? 3001);
await app.listen(port, "0.0.0.0");
console.info(`API listening on 0.0.0.0:${port}`);
