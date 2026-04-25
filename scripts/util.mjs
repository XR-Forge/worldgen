export function getQueryParams(url) {
    const query = url.split('?')[1]?.split('#')[0];
    if (!query) return {};

    return query.split('&').reduce((acc, pair) => {
        const [k, v] = pair.split('=');
        acc[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
        return acc;
    }, {});
}

const href = window.top?.location.href ?? '';
const params = getQueryParams(href);
// const url = new URL(href);
const root = document.URL.replace(/\/([^/]+\.html)?$/g, '');

/**
 * @type {string}
 */
export const rootPath = root.replace(/\/iframe/g, '');