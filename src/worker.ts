import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger as PinoLogger } from 'nestjs-pino';
import { Logger } from '@nestjs/common';

async function bootstrapWorker() {
    const app = await NestFactory.createApplicationContext(AppModule, {
        bufferLogs: true,
    });

    const pinoLogger = app.get(PinoLogger);
    app.useLogger(pinoLogger);

    await app.init();

    pinoLogger.log('Worker process started and listening for jobs...');
}

bootstrapWorker().catch(err => {
    const logger = new Logger('WorkerBootstrap');
    logger.error(`Worker failed to start: ${err.message}`, err.stack);
    process.exit(1);
});