export type CodexAssetKind = 'image' | 'audio';

const DB_NAME = 'aichat-codex-shorts';
const STORE_NAME = 'assets';
const DB_VERSION = 1;

const keyOf = (jobId: string, segmentId: string, kind: CodexAssetKind) => `${jobId}:${segmentId}:${kind}`;

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('작업 파일 저장소를 열지 못했습니다.'));
    });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDb();
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, mode);
            const request = action(tx.objectStore(STORE_NAME));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('작업 파일 처리에 실패했습니다.'));
        });
    } finally {
        db.close();
    }
}

export const putCodexAsset = (jobId: string, segmentId: string, kind: CodexAssetKind, file: File): Promise<IDBValidKey> =>
    run('readwrite', store => store.put(file, keyOf(jobId, segmentId, kind)));

export const getCodexAsset = (jobId: string, segmentId: string, kind: CodexAssetKind): Promise<Blob | undefined> =>
    run('readonly', store => store.get(keyOf(jobId, segmentId, kind)));

export const deleteCodexAsset = (jobId: string, segmentId: string, kind: CodexAssetKind): Promise<undefined> =>
    run('readwrite', store => store.delete(keyOf(jobId, segmentId, kind))) as Promise<undefined>;
