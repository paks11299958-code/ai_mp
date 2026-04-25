import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = 'ai-mp-media';

let storage: Storage | null = null;

function getStorage(): Storage {
    if (storage) return storage;

    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credsJson) {
        const credentials = JSON.parse(credsJson);
        storage = new Storage({ credentials, projectId: credentials.project_id });
    } else {
        storage = new Storage();
    }
    return storage;
}

export async function uploadToGCS(
    buffer: Buffer,
    destPath: string,
    mimeType: string
): Promise<string> {
    const gcs = getStorage();
    const bucket = gcs.bucket(BUCKET_NAME);
    const file = bucket.file(destPath);

    await file.save(buffer, {
        metadata: { contentType: mimeType },
        resumable: false,
    });

    return `https://storage.googleapis.com/${BUCKET_NAME}/${destPath}`;
}

export async function deleteFromGCS(publicUrl: string): Promise<void> {
    try {
        const prefix = `https://storage.googleapis.com/${BUCKET_NAME}/`;
        if (!publicUrl.startsWith(prefix)) return;
        const filePath = publicUrl.slice(prefix.length);
        const gcs = getStorage();
        await gcs.bucket(BUCKET_NAME).file(filePath).delete();
    } catch {
        // 파일이 없어도 무시
    }
}
