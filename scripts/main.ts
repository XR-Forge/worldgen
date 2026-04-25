import * as util from './util.mjs';
import * as pc from 'playcanvas';
import { GsplatRevealRadial } from './gsplat/reveal-radial.mjs';
import { GsplatShaderRaycastEffect } from './gsplat/gsplat-shader-raycast-effect.mjs';
import { Raycast } from './raycast.mjs';
import { createLoader } from './loader.mjs';
import { Asset } from '../globals.js';
import('./html-handler.mjs');
import('./css-handler.mjs');

const DEVICE_TYPES = ['webgpu', 'webgl2', 'null'];
export let deviceType = 'webgl2';

export const deviceReady = (async () => {
    const el = document.getElementById('application');
    if (!(el instanceof HTMLCanvasElement)) {
        throw new Error('Element #application-canvas ist kein <canvas>');
    }

    const gfxOptions = {
        deviceTypes: [deviceType],
        antialias: false
    };

    const p: any = {};
    p.canvas = el;
    p.device = await pc.createGraphicsDevice(el, gfxOptions);
    p.device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

    return p;
})();

/**
 * List of materials to cycle through.
 * 
 * @attribute
 * @type {AppBase}
 */
let app: pc.AppBase | null = null;
let camera: pc.Entity;
let autoRotateEnabled = true;
let lastInteractionTime = 0;
let autoRotateDelay = 2;
let autoRotateSpeed = 10;
let box = null;
let highlightEffect: GsplatShaderRaycastEffect | null = null;
let raycastScript: Raycast | null = null;
let gsplatEntity: pc.Entity | null = null;
let gsplatMeshInstance: pc.MeshInstance | null = null;
let gsplatCenters: Float32Array | null = null;
let gsplatChunkBounds: Float32Array | null = null;
let gsplatResourceId: number | null = null;
const gsplatChunkSize = 256;

deviceReady.then(async (p) => {
    console.log("start");

    app = new pc.Application(p.canvas, {
        graphicsDevice: p.device,
        mouse: new pc.Mouse(p.canvas),
        touch: new pc.TouchDevice(p.canvas)
    });

    await import('./orbit-camera.js');

    p.canvas.style.position = 'fixed';
    p.canvas.style.top = '0';
    p.canvas.style.left = '0';
    p.canvas.style.zIndex = '-1';
    p.canvas.style.opacity = '0';
    p.canvas.style.transition = 'opacity 3.6s ease';


    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Ensure canvas is resized when window changes size
    const resize = () => app?.resizeCanvas();
    window.addEventListener('resize', resize);

    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });
    
    app.on('update', (dt) => {
        // Re-enable auto-rotate after delay
        if (!autoRotateEnabled && (Date.now() - lastInteractionTime) / 1000 > autoRotateDelay) {
            autoRotateEnabled = true;
        }
        // Apply auto-rotation
        if (autoRotateEnabled) {
            const orbitCamera = camera.script?.get('orbitCamera');
            if (orbitCamera) {
                (orbitCamera as any).yaw += autoRotateSpeed * dt;
            }
        }

        //box.rotate(10 * dt, 10 * dt, 10 * dt);
    });

    const loaderUi = createLoader();

    const gsplatFiles = [
        '01-campus.ply.sog',
        '02-science-lab.ply.sog',
        '03-library.ply.sog',
        '04-showroom.ply.sog',
        '05-brand-env.ply.sog',
        '06-exhibition-hall.ply.sog',
        '07-factory-hall.ply.sog',
        '08-training-env.ply.sog',
        '09-process-viz.ply.sog',
        '10-xr-platform.ply.sog',
    ];
    const gsplatAssets = gsplatFiles.map((file) => {
        const asset = new pc.Asset(file, 'gsplat', {
            // url: `${util.rootPath}/scenes/${file}`
            url: `${util.rootPath}/${file}`
        });
        app.assets.add(asset);
        return asset;
    });

    const scene = new pc.Entity('scene');
    gsplatEntity = scene;
    scene.addComponent('gsplat', {
        asset: gsplatAssets[0],
        unified: true
    });
    scene.addComponent('script');
    let revealEffect: any = null;
    // highlightEffect = scene.script.create(GsplatShaderRaycastEffect, {
    //     properties: {
    //         radius: 0.8,
    //         softness: 0.6,
    //         blend: 0.9,
    //         highlightColor: new pc.Color(0.95, 0.6, 0.2)
    //     }
    // }) as GsplatShaderRaycastEffect;
    const createRevealEffect = () => {
        if (scene.script.has(GsplatRevealRadial)) {
            scene.script.destroy(GsplatRevealRadial.scriptName);
        }
        revealEffect = scene.script.create(GsplatRevealRadial, {
            properties: {
                center: new pc.Vec3(0, 0, 0),
                speed: 2,
                acceleration: 0,
                delay: 5,
                dotTint: new pc.Color(0, 0.7, 0.9),
                waveTint: new pc.Color(0.259, 0.106, 0.871),
                oscillationIntensity: 0.2,
                endRadius: 25
            }
        });
    };
    app.root.addChild(scene);

    let loadedCount = 0;
    const loadStartTime = performance.now();
    const updateProgress = () => {
        const totalAssets = gsplatAssets.length;
        loaderUi.setProgress((loadedCount / totalAssets) * 100);
        if (loadedCount > 0) {
            const elapsedSeconds = (performance.now() - loadStartTime) / 1000;
            const averagePerAsset = elapsedSeconds / loadedCount;
            const remainingSeconds = averagePerAsset * (totalAssets - loadedCount);
            loaderUi.setEta(remainingSeconds);
        } else {
            loaderUi.setEta(Number.NaN);
        }
    };
    updateProgress();

    const preloadGsplats = Promise.all(
        gsplatAssets.map((asset) => new Promise<void>((resolve, reject) => {
            if (asset.loaded) {
                loadedCount += 1;
                updateProgress();
                resolve();
                return;
            }
            asset.once('load', () => {
                loadedCount += 1;
                updateProgress();
            });
            asset.ready(() => resolve());
            asset.once('error', (err) => reject(err));
            app.assets.load(asset);
        }))
    );

    const replayRevealEffect = () => {
        app.once('frameupdate', () => {
            createRevealEffect();
            refreshGsplatData();
        });
    };

    let gsplatIndex = 0;
    let effectTimerId: number | null = null;
    let isSwitching = false;
    const switchGsplat = () => {
        if (isSwitching) {
            return;
        }
        isSwitching = true;
        const previousAsset = gsplatAssets[gsplatIndex];
        gsplatIndex = (gsplatIndex + 1) % gsplatAssets.length;
        const nextAsset = gsplatAssets[gsplatIndex];

        if (effectTimerId !== null) {
            window.clearTimeout(effectTimerId);
            effectTimerId = null;
        }
        if (revealEffect) {
            revealEffect.destroy();
            revealEffect = null;
        }

        const applyNext = () => {
            scene.gsplat.asset = nextAsset;
            replayRevealEffect();
            isSwitching = false;
        };

        if (nextAsset.loaded) {
            applyNext();
        } else {
            nextAsset.ready(applyNext);
        }
    };

    preloadGsplats
        .then(() => {
            loaderUi.remove();
            requestAnimationFrame(() => {
                p.canvas.style.opacity = '1';
            });
            scene.gsplat.asset = gsplatAssets[0];
            replayRevealEffect();
            window.setInterval(switchGsplat, 20000);
        })
        .catch((err) => {
            loaderUi.setError('Failed to load gsplat assets.');
            console.error(err);
        });

    // create a camera
    camera = new pc.Entity();
    camera.addComponent('camera', {
        //clearColor: new pc.Color(0.3, 0.3, 0.3),
        clearColor: new pc.Color(0, 0, 0),
        fov: 50
    });
    camera.setPosition(0, 0, 1);
    app.root.addChild(camera);
    
    // create a light
    const light = new pc.Entity();
    light.addComponent('light');
    light.setEulerAngles(45, 45, 0);
    app.root.addChild(light);
    
    const focusAnchor = new pc.Entity('center');
    app.root.addChild(focusAnchor);

    // const assets = [
    //     new pc.Asset('html-asset', 'html', { url: `${util.rootPath}/ui.html` }),
    //     new pc.Asset('css-asset', 'css', { url: `${util.rootPath}/ui.css` })
    // ];
    // // `app` has been initialised above; assert it here and null‑check later.
    // const assetListLoader = new pc.AssetListLoader(assets, app!.assets);
    // assetListLoader.load((err, failed) => {
    //     if (err) {
    //         console.error(`${failed.length} assets failed to load`);
    //     } else if (app) {
    //         console.log(`${assets.length} assets loaded`);
    //         const htmlCss = new pc.Entity('html-css');
    //         htmlCss.addComponent('script');

    //         // use the asset we already created instead of looking it up by name
    //         const htmlAsset = assets[0];
    //         console.log('html asset', htmlAsset);
    //         if (htmlAsset) {
    //             console.log('html asset', htmlAsset);
    //             // cast via `unknown` to avoid the unrelated‑type error
    //             htmlCss.script?.create('htmlHandler', { properties: { html: htmlAsset as unknown as Asset } });
    //         }
    //         const cssAsset = assets[1];
    //         if (cssAsset) {
    //             htmlCss.script?.create('cssHandler', { properties: { css: cssAsset as unknown as Asset } });
    //         }

    //         //app.root.addChild(htmlCss);
    //         // focusAnchor.addChild(htmlCss);
    //     }
    // });

    // const htmlCss = new pc.Entity('html-css');
    // htmlCss.addComponent('script');
    // htmlCss.script?.create('htmlHandler', {
    //     properties: {
    //         asset: new pc.Asset('html-asset', 'html', {
    //             url: `${util.rootPath}/ui.html`
    //         })
    //     }
    // });
    // htmlCss.script?.create('cssHandler', {
    //     properties: {
    //         asset: new pc.Asset('css-asset', 'css', {
    //             url: `${util.rootPath}/ui.css`
    //         })
    //     }
    // });
    // app.root.addChild(htmlCss);
    // focusAnchor.addChild(htmlCss);

    const glassesAsset = new pc.Asset('vr-glasses', 'container', {
        url: `${util.rootPath}/assets/vr-glasses.glb`
    });
    app.assets.add(glassesAsset);
    glassesAsset.ready(() => {
        const glassesEntity = glassesAsset.resource.instantiateRenderEntity();
        glassesEntity.setLocalPosition(0, 0, 0);
        glassesEntity.setLocalScale(0.0003, 0.0003, 0.0003);
        focusAnchor.addChild(glassesEntity);
    });
    app.assets.load(glassesAsset);

    // add orbit camera script with a mouse and a touch support
    camera.addComponent('script');
    raycastScript = camera.script?.create(Raycast, {
        properties: {
            distance: 200,
            firstHitOnly: false
        }
    }) as Raycast;
    camera.script?.create('orbitCamera', {
        attributes: {
            inertiaFactor: 0.2,
            focusEntity: focusAnchor,
            distanceMax: 1.2,
            frameOnStart: false
        }
    });
    camera.script?.create('orbitCameraInputMouse');
    camera.script?.create('orbitCameraInputTouch');
    app.root.addChild(camera);

    // Detect user interaction (click/touch only, not mouse movement)
    const onUserInteraction = () => {
        autoRotateEnabled = false;
        lastInteractionTime = Date.now();
    };

    // Listen for click and touch events only
    if (app.mouse) {
        app.mouse.on('mousedown', onUserInteraction);
        app.mouse.on('mousewheel', onUserInteraction);
        console.log("mousewheel");
    }
    if (app.touch) {
        app.touch.on('touchstart', onUserInteraction);
        console.log("touch");
    }

    const rayOrigin = new pc.Vec3();
    const rayTarget = new pc.Vec3();
    const rayDirection = new pc.Vec3();
    const rayEnd = new pc.Vec3();
    const gsplatWorldToLocal = new pc.Mat4();
    const gsplatLocalToWorld = new pc.Mat4();
    const gsplatLocalOrigin = new pc.Vec3();
    const gsplatLocalDirection = new pc.Vec3();
    const gsplatLocalRayEnd = new pc.Vec3();
    const gsplatLocalHit = new pc.Vec3();
    const gsplatWorldHit = new pc.Vec3();
    const gsplatRay = new pc.Ray();

    const buildGsplatChunkBounds = (centers: Float32Array) => {
        const numSplats = Math.floor(centers.length / 3);
        const numChunks = Math.ceil(numSplats / gsplatChunkSize);
        const bounds = new Float32Array(numChunks * 6);
        for (let c = 0; c < numChunks; c += 1) {
            const start = c * gsplatChunkSize;
            const end = Math.min(numSplats, start + gsplatChunkSize);
            let minX = Infinity;
            let minY = Infinity;
            let minZ = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            let maxZ = -Infinity;
            for (let i = start; i < end; i += 1) {
                const idx = i * 3;
                const x = centers[idx + 0];
                const y = centers[idx + 1];
                const z = centers[idx + 2];
                if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
                    continue;
                }
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (z < minZ) minZ = z;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
                if (z > maxZ) maxZ = z;
            }
            if (minX === Infinity) {
                minX = minY = minZ = 0;
                maxX = maxY = maxZ = 0;
            }
            const base = c * 6;
            bounds[base + 0] = minX;
            bounds[base + 1] = minY;
            bounds[base + 2] = minZ;
            bounds[base + 3] = maxX;
            bounds[base + 4] = maxY;
            bounds[base + 5] = maxZ;
        }
        return bounds;
    };

    const refreshGsplatData = () => {
        const instance = gsplatEntity?.gsplat?.instance;
        const resource = instance?.resource as any;
        if (!resource) {
            gsplatResourceId = null;
            gsplatMeshInstance = null;
            gsplatCenters = null;
            gsplatChunkBounds = null;
            return;
        }
        if (gsplatResourceId === resource.id) {
            gsplatMeshInstance = instance?.meshInstance ?? null;
            return;
        }
        gsplatResourceId = resource.id;
        gsplatMeshInstance = instance?.meshInstance ?? null;
        gsplatCenters = resource.centers ?? null;
        const resourceChunks = resource?.chunks as Float32Array | undefined;
        if (resourceChunks && resourceChunks.length > 0) {
            gsplatChunkBounds = resourceChunks;
        } else if (gsplatCenters) {
            gsplatChunkBounds = buildGsplatChunkBounds(gsplatCenters);
        } else {
            gsplatChunkBounds = null;
        }
    };

    const intersectRayAabb = (
        ox: number,
        oy: number,
        oz: number,
        dx: number,
        dy: number,
        dz: number,
        minX: number,
        minY: number,
        minZ: number,
        maxX: number,
        maxY: number,
        maxZ: number,
        maxDistance: number
    ) => {
        let tmin = -Infinity;
        let tmax = Infinity;
        const eps = 1e-8;

        if (Math.abs(dx) < eps) {
            if (ox < minX || ox > maxX) {
                return null;
            }
        } else {
            const tx1 = (minX - ox) / dx;
            const tx2 = (maxX - ox) / dx;
            tmin = Math.max(tmin, Math.min(tx1, tx2));
            tmax = Math.min(tmax, Math.max(tx1, tx2));
        }

        if (Math.abs(dy) < eps) {
            if (oy < minY || oy > maxY) {
                return null;
            }
        } else {
            const ty1 = (minY - oy) / dy;
            const ty2 = (maxY - oy) / dy;
            tmin = Math.max(tmin, Math.min(ty1, ty2));
            tmax = Math.min(tmax, Math.max(ty1, ty2));
        }

        if (Math.abs(dz) < eps) {
            if (oz < minZ || oz > maxZ) {
                return null;
            }
        } else {
            const tz1 = (minZ - oz) / dz;
            const tz2 = (maxZ - oz) / dz;
            tmin = Math.max(tmin, Math.min(tz1, tz2));
            tmax = Math.min(tmax, Math.max(tz1, tz2));
        }

        if (tmax < tmin) {
            return null;
        }
        if (tmax < 0) {
            return null;
        }
        const tHit = tmin >= 0 ? tmin : tmax;
        if (tHit > maxDistance) {
            return null;
        }
        return tHit;
    };

    // const findGsplatHit = (origin: pc.Vec3, direction: pc.Vec3, endPoint: pc.Vec3) => {
    //     if (!gsplatEntity) {
    //         return null;
    //     }
    //     if (!gsplatCenters || !gsplatChunkBounds) {
    //         if (gsplatMeshInstance?.aabb) {
    //             gsplatRay.origin.copy(origin);
    //             gsplatRay.direction.copy(direction);
    //             if (gsplatMeshInstance.aabb.intersectsRay(gsplatRay, gsplatWorldHit)) {
    //                 return gsplatWorldHit;
    //             }
    //         }
    //         return null;
    //     }

    //     gsplatWorldToLocal.copy(gsplatEntity.getWorldTransform()).invert();
    //     gsplatWorldToLocal.transformPoint(origin, gsplatLocalOrigin);
    //     gsplatWorldToLocal.transformVector(direction, gsplatLocalDirection);
    //     gsplatLocalDirection.normalize();
    //     gsplatWorldToLocal.transformPoint(endPoint, gsplatLocalRayEnd);
    //     const maxDistanceLocal = Math.max(0, gsplatLocalRayEnd.sub(gsplatLocalOrigin).dot(gsplatLocalDirection));

    //     const numChunks = Math.floor(gsplatChunkBounds.length / 6);
    //     let bestChunk = -1;
    //     let bestChunkT = Infinity;
    //     const ox = gsplatLocalOrigin.x;
    //     const oy = gsplatLocalOrigin.y;
    //     const oz = gsplatLocalOrigin.z;
    //     const dx = gsplatLocalDirection.x;
    //     const dy = gsplatLocalDirection.y;
    //     const dz = gsplatLocalDirection.z;

    //     for (let c = 0; c < numChunks; c += 1) {
    //         const base = c * 6;
    //         const minX = gsplatChunkBounds[base + 0];
    //         const minY = gsplatChunkBounds[base + 1];
    //         const minZ = gsplatChunkBounds[base + 2];
    //         const maxX = gsplatChunkBounds[base + 3];
    //         const maxY = gsplatChunkBounds[base + 4];
    //         const maxZ = gsplatChunkBounds[base + 5];
    //         const tHit = intersectRayAabb(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ, maxDistanceLocal);
    //         if (tHit !== null && tHit < bestChunkT) {
    //             bestChunkT = tHit;
    //             bestChunk = c;
    //         }
    //     }

    //     if (bestChunk < 0) {
    //         return null;
    //     }

    //     const numSplats = Math.floor(gsplatCenters.length / 3);
    //     const start = bestChunk * gsplatChunkSize;
    //     const end = Math.min(numSplats, start + gsplatChunkSize);
    //     let bestIndex = -1;
    //     let bestDist2 = Infinity;
    //     let bestT = bestChunkT;
    //     for (let i = start; i < end; i += 1) {
    //         const idx = i * 3;
    //         const cx = gsplatCenters[idx + 0];
    //         const cy = gsplatCenters[idx + 1];
    //         const cz = gsplatCenters[idx + 2];
    //         if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(cz)) {
    //             continue;
    //         }
    //         const vx = cx - ox;
    //         const vy = cy - oy;
    //         const vz = cz - oz;
    //         const t = vx * dx + vy * dy + vz * dz;
    //         if (t < 0 || t > maxDistanceLocal) {
    //             continue;
    //         }
    //         const dist2 = vx * vx + vy * vy + vz * vz - t * t;
    //         if (dist2 < bestDist2) {
    //             bestDist2 = dist2;
    //             bestIndex = i;
    //             bestT = t;
    //         }
    //     }

    //     const maxPickRadius = highlightEffect ? Math.max(0.1, highlightEffect.radius * 1.5) : 1.0;
    //     const maxPickRadius2 = maxPickRadius * maxPickRadius;
    //     if (bestIndex >= 0 && bestDist2 <= maxPickRadius2) {
    //         const idx = bestIndex * 3;
    //         gsplatLocalHit.set(
    //             gsplatCenters[idx + 0],
    //             gsplatCenters[idx + 1],
    //             gsplatCenters[idx + 2]
    //         );
    //     } else {
    //         gsplatLocalHit.copy(gsplatLocalDirection).mulScalar(bestT).add(gsplatLocalOrigin);
    //     }

    //     gsplatLocalToWorld.copy(gsplatEntity.getWorldTransform());
    //     gsplatLocalToWorld.transformPoint(gsplatLocalHit, gsplatWorldHit);
    //     return gsplatWorldHit;
    // };

    let pointerActive = false;
    let pointerX = 0;
    let pointerY = 0;

    // const updateHighlightFromScreen = (x: number, y: number) => {
    //     if (!highlightEffect || !camera.camera) {
    //         return;
    //     }

    //     refreshGsplatData();
    //     camera.camera.screenToWorld(x, y, camera.camera.nearClip, rayOrigin);
    //     camera.camera.screenToWorld(x, y, camera.camera.farClip, rayTarget);
    //     rayDirection.copy(rayTarget).sub(rayOrigin).normalize();
    //     const maxRayDistance = camera.camera.farClip - camera.camera.nearClip;
    //     rayEnd.copy(rayDirection).mulScalar(maxRayDistance).add(rayOrigin);

    //     const applyHit = (hitPoint: pc.Vec3) => {
    //         highlightEffect.center.copy(hitPoint);
    //         highlightEffect.blend = 0.9;
    //     };

    //     const clearHit = () => {
    //         highlightEffect.blend = 0;
    //     };

    //     const tryGsplatHit = () => {
    //         const gsplatHit = findGsplatHit(rayOrigin, rayDirection, rayEnd);
    //         if (gsplatHit) {
    //             applyHit(gsplatHit);
    //             return true;
    //         }
    //         return false;
    //     };

    //     if (!raycastScript) {
    //         if (!tryGsplatHit()) {
    //             clearHit();
    //         }
    //         return;
    //     }

    //     raycastScript.raycast((hits) => {
    //         if (hits.length) {
    //             applyHit(hits[0].point);
    //             return;
    //         }
    //         if (!tryGsplatHit()) {
    //             clearHit();
    //         }
    //     }, {
    //         origin: rayOrigin,
    //         direction: rayDirection,
    //         distance: maxRayDistance
    //     });
    // };

    if (app.mouse) {
        app.mouse.on('mousemove', (event: pc.MouseEvent) => {
            pointerActive = true;
            pointerX = event.x;
            pointerY = event.y;
        });
        app.mouse.on('mouseleave', () => {
            pointerActive = false;
            if (highlightEffect) {
                highlightEffect.blend = 0;
            }
        });
    }
    if (app.touch) {
        app.touch.on('touchstart', (event: pc.TouchEvent) => {
            const touch = event.touches[0];
            if (touch) {
                pointerActive = true;
                pointerX = touch.x;
                pointerY = touch.y;
            }
        });
        app.touch.on('touchmove', (event: pc.TouchEvent) => {
            const touch = event.touches[0];
            if (touch) {
                pointerActive = true;
                pointerX = touch.x;
                pointerY = touch.y;
            }
        });
        app.touch.on('touchend', () => {
            pointerActive = false;
            if (highlightEffect) {
                highlightEffect.blend = 0;
            }
        });
    }

    // app.on('update', () => {
    //     if (!pointerActive) {
    //         return;
    //     }
    //     updateHighlightFromScreen(pointerX, pointerY);
    // });
    
    app.start();

    console.log("app.start");
});

export { app };
