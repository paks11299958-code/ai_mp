interface ServiceWorkerUpdateClient {
    controller: unknown;
    addEventListener: (type: 'controllerchange', listener: () => void) => void;
    register: (scriptURL: string) => Promise<unknown>;
}

/**
 * 커밋마다 다른 SW URL로 업데이트를 강제 검사한다.
 * 기존 worker가 있던 탭만 controller 교체 때 한 번 새로고침한다.
 */
export const registerVersionedServiceWorker = (
    serviceWorker: ServiceWorkerUpdateClient,
    buildId: string,
    reload: () => void,
): Promise<unknown> => {
    const hadController = Boolean(serviceWorker.controller);
    let refreshing = false;

    serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || refreshing) return;
        refreshing = true;
        reload();
    });

    return serviceWorker.register(`/sw.js?v=${encodeURIComponent(buildId)}`);
};
