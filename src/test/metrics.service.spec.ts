import { MetricsService } from '../metrics/metrics.service';

describe('MetricsService', () => {
    let service: MetricsService;

    beforeEach(() => {
        service = new MetricsService();
        service.onModuleInit();
    });

    afterEach(() => {
        service.onModuleDestroy();
    });

    it('should expose default metrics', async () => {
        const registry = service.getRegistry();
        const output = await registry.metrics();
        expect(output).toContain('# HELP process_cpu_user_seconds_total');
    });
});
