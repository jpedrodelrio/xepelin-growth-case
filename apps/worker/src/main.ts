import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module.js";

await NestFactory.createApplicationContext(WorkerModule);
