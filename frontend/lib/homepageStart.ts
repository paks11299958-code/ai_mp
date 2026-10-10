export type HomepageStartStep = 'intro' | 'form' | 'list';

const HOMEPAGE_START_KEY = 'homepage:start-step';

export const setHomepageBoardStartStep = (step: HomepageStartStep) => {
    try { sessionStorage.setItem(HOMEPAGE_START_KEY, step); } catch { /* storage blocked: intro remains safe */ }
};

export const takeHomepageBoardStartStep = (): HomepageStartStep => {
    try {
        const value = sessionStorage.getItem(HOMEPAGE_START_KEY);
        sessionStorage.removeItem(HOMEPAGE_START_KEY);
        return value === 'form' || value === 'list' ? value : 'intro';
    } catch { return 'intro'; }
};
