import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
    HealthCheck,
    HealthCheckService,
    MemoryHealthIndicator,
    DiskHealthIndicator,
} from '@nestjs/terminus';

@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private memory: MemoryHealthIndicator,
        private disk: DiskHealthIndicator,
    ) {}

    @Get('/live')
    getLive() {
        return { status: 'ok' };
    }

    @Get('/ready')
    @HealthCheck()
    async getReady() {
        return this.health.check([
            async () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
            async () =>
                this.disk.checkStorage('disk_root', {
                    path: '/',
                    thresholdPercent: 0.9,
                }),
        ]);
    }
}
