import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule);
app.setGlobalPrefix("api");
app.enableCors({ origin: process.env.WEB_URL ?? "http://localhost:3000" });
app.getHttpAdapter().get("/health", (_request: unknown, response: { send: (body: unknown) => void }) => response.send({ status: "ok" }));
await app.listen(Number(process.env.PORT ?? 3001));
