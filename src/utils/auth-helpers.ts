export const getOrCreateAnonymousId = (): string => {
    if (typeof window === 'undefined') return ''; // Server-side safety

    const STORAGE_KEY = 'youcango_anonymous_id';
    let id = localStorage.getItem(STORAGE_KEY);

    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEY, id);
    }

    return id;
};
