import { describe, expect, it, vi } from 'vitest';
import { registerVersionedServiceWorker } from './serviceWorkerUpdate';

const makeWorker = (hasController: boolean) => {
    let onControllerChange: (() => void) | undefined;
    const worker = {
        controller: hasController ? {} : null,
        addEventListener: vi.fn((_type: 'controllerchange', listener: () => void) => {
            onControllerChange = listener;
        }),
        register: vi.fn().mockResolvedValue({}),
    };
    return { worker, changeController: () => onControllerChange?.() };
};

describe('registerVersionedServiceWorker', () => {
    it('커밋별 URL을 등록하고 기존 탭은 controller 교체 때 한 번만 새로고침한다', async () => {
        const { worker, changeController } = makeWorker(true);
        const reload = vi.fn();
        await registerVersionedServiceWorker(worker, 'a5f833a', reload);

        expect(worker.register).toHaveBeenCalledWith('/sw.js?v=a5f833a');
        changeController();
        changeController();
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('첫 방문의 최초 controller 설치는 불필요한 새로고침을 하지 않는다', async () => {
        const { worker, changeController } = makeWorker(false);
        const reload = vi.fn();
        await registerVersionedServiceWorker(worker, 'first build', reload);

        expect(worker.register).toHaveBeenCalledWith('/sw.js?v=first%20build');
        changeController();
        expect(reload).not.toHaveBeenCalled();
    });
});
