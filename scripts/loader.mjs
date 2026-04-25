import * as util from './util.mjs';

export function createLoader() {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.background = 'rgba(0, 0, 0, 0.85)';
    overlay.style.zIndex = '2';
    document.body.appendChild(overlay);

    const loader = document.createElement('div');
    loader.style.position = 'fixed';
    loader.style.top = '0';
    loader.style.left = '0';
    loader.style.right = '0';
    loader.style.bottom = '0';
    loader.style.display = 'flex';
    loader.style.alignItems = 'center';
    loader.style.justifyContent = 'center';
    loader.style.color = '#fff';
    loader.style.fontFamily = 'Georgia, serif';
    loader.style.fontSize = '18px';
    loader.style.zIndex = '3';
    document.body.appendChild(loader);

    const loaderInner = document.createElement('div');
    loaderInner.style.display = 'flex';
    loaderInner.style.flexDirection = 'column';
    loaderInner.style.alignItems = 'center';
    loaderInner.style.gap = '16px';
    loader.appendChild(loaderInner);

    const loaderStatus = document.createElement('div');
    loaderStatus.style.display = 'flex';
    loaderStatus.style.alignItems = 'center';
    loaderStatus.style.gap = '10px';
    loaderStatus.style.letterSpacing = '0.12em';
    loaderStatus.style.fontSize = '12px';
    loaderStatus.style.opacity = '0.85';
    const loaderLabel = document.createElement('div');
    loaderLabel.textContent = 'Loading 1.3 GB ';
    loaderLabel.style.textTransform = 'uppercase';
    loaderStatus.appendChild(loaderLabel);

    const loaderPercent = document.createElement('div');
    loaderPercent.textContent = '0%';
    loaderPercent.style.fontSize = '12px';
    loaderStatus.appendChild(loaderPercent);

    const loaderEta = document.createElement('div');
    loaderEta.textContent = 'Estimating...';
    loaderEta.style.textTransform = 'uppercase';
    loaderStatus.appendChild(loaderEta);

    const loaderLogo = document.createElement('img');
    loaderLogo.src = `${util.rootPath}/assets/xr-forge-logo-without-text.png`;
    loaderLogo.alt = 'XR Forge';
    loaderLogo.style.width = '160px';
    loaderLogo.style.height = '160px';
    loaderLogo.style.objectFit = 'contain';
    loaderLogo.style.animation = 'loaderSpin 10s linear infinite, loaderPulse 2.6s ease-in-out infinite';
    loaderLogo.style.marginBottom = '16px';
    loaderInner.appendChild(loaderLogo);

    loaderInner.appendChild(loaderStatus);

    const loaderStyle = document.createElement('style');
    loaderStyle.textContent = `
@keyframes loaderPulse {
  0%, 100% { transform: scale(0.9); }
  50% { transform: scale(1.1); }
}
@keyframes loaderSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;
    document.head.appendChild(loaderStyle);

    return {
        element: loader,
        remove: () => {
            loader.remove();
            overlay.remove();
        },
        setProgress: (value) => {
            const percent = Math.max(0, Math.min(100, Math.round(value)));
            loaderPercent.textContent = `${percent}%`;
        },
        setEta: (seconds) => {
            if (!Number.isFinite(seconds) || seconds < 0) {
                loaderEta.textContent = 'Estimating...';
                return;
            }
            const roundedSeconds = Math.max(0, Math.ceil(seconds));
            loaderEta.textContent = `~${roundedSeconds}s remaining`;
        },
        setError: (message) => {
            loader.textContent = message;
        }
    };
}
