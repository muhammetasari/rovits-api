// src/worker.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module'; // AppModule'ü geçici olarak kullanacağız, sonra küçülteceğiz
import { JobProcessorModule } from './job-processor/job-processor.module';
import { Logger } from '@nestjs/common';

async function bootstrapWorker() {
    // Standalone application: HTTP sunucusu başlatmaz, sadece modülleri yükler.
    // AppModule yerine sadece worker'ın ihtiyacı olan modülleri içeren
    // daha küçük bir modül (WorkerModule gibi) oluşturmak daha iyidir,
    // ama şimdilik AppModule'ü kullanabiliriz. NestJS, HTTP ile ilgili
    // kısımları başlatmayacaktır.
    const app = await NestFactory.createApplicationContext(AppModule);

    // JobProcessorModule'ün yüklenmesini bekleyebiliriz (isteğe bağlı)
    await app.init();

    const logger = new Logger('Worker');
    logger.log('Worker process started and listening for jobs...');

    // Worker'ın sürekli çalışmasını sağlamak için (eğer gerekirse)
    // process.on('SIGTERM', async () => {
    //     logger.log('Received SIGTERM. Shutting down worker...');
    //     await app.close();
    //     process.exit(0);
    // });
    // process.on('SIGINT', async () => {
    //     logger.log('Received SIGINT. Shutting down worker...');
    //     await app.close();
    //     process.exit(0);
    // });
}

bootstrapWorker().catch(err => {
    const logger = new Logger('WorkerBootstrap');
    logger.error(`Worker failed to start: ${err.message}`, err.stack);
    process.exit(1);
});