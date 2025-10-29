import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
    private readonly registry = new client.Registry();

    onModuleInit() {
        // prom-client v15: geriye değer döndürmez (void)
        client.collectDefaultMetrics({
            register: this.registry,
        });
    }

    onModuleDestroy() {
        // v15'te durdurma API'si yok. Ek işlem gerekmiyor.
        // İsterseniz proses çıkışında metrikleri temizlemek için:
        // this.registry.clear();
    }

    getRegistry(): client.Registry {
        return this.registry;
    }
}
