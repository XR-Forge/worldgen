import { Script } from 'playcanvas';

/**
 * Base class for gsplat shader effects.
 * Handles common functionality like material management, shader application,
 * time tracking, and uniform updates.
 *
 * **Usage:**
 * Attach this script to an entity with a gsplat component. The script automatically detects
 * whether the gsplat is in unified or non-unified mode and handles material access accordingly.
 *
 * **Non-Unified Mode (`unified=false`):**
 * Each gsplat component has its own material. The script accesses the material directly via
 * `entity.gsplat.material` and applies shader customizations immediately or when the asset loads.
 *
 * **Unified Mode (`unified=true`):**
 * Multiple gsplat components share a template material accessible via `app.scene.gsplat.material`.
 * The script applies shader customizations to this template material.
 *
 * **Enable/Disable:**
 * When enabled, the shader effect is applied and effectTime starts tracking from 0.
 * When disabled, the custom shader is removed and materials revert to default rendering.
 *
 * Subclasses must implement:
 * - getShaderGLSL(): Return GLSL shader string
 * - getShaderWGSL(): Return WGSL shader string
 * - updateEffect(effectTime, dt): Update effect each frame
 *
 * @abstract
 */
export class GsplatShaderEffect extends Script {
    static scriptName = 'gsplatShaderEffect';

    /**
     * Time since effect was enabled
     * @type {number}
     */
    effectTime = 0;

    /**
     * The material this effect is applied to
     * @type {import('playcanvas').Material | null}
     */
    material = null;
    _unifiedMaterial = null;

    initialize() {
        this.initialized = false;
        this.effectTime = 0;
        this.material = null;
        this.shadersNeedApplication = true;
        this._materialListenerAttached = false;
        this._missingMaterialWarned = false;
        this._onMaterialCreated = (material) => {
            if (!this.entity.gsplat?.unified) {
                return;
            }
            if (this.material === material) {
                return;
            }
            this._unifiedMaterial = material;
            this.material = material;
            this.applyShaderToMaterial(material);
        };

        // Listen to enable/disable events
        this.on('enable', () => {
            // Reset effect time when enabling
            this.effectTime = 0;

            // Ensure we're initialized
            if (!this.initialized && this.entity.gsplat) {
                this.initialized = true;
            }

            // Apply shaders if initialized, otherwise flag for application
            if (this.initialized) {
                this.applyShaders();
            } else {
                this.shadersNeedApplication = true;
            }
        });

        this.on('disable', () => {
            // Remove shaders when disabling
            this.removeShaders();
        });

        if (!this.entity.gsplat) {
            // gsplat component not yet available, will retry each frame
            return;
        }

        this.initialized = true;

        if (this.entity.gsplat?.unified && !this._materialListenerAttached) {
            this.app.systems.gsplat.on('material:created', this._onMaterialCreated);
            this._materialListenerAttached = true;
        }
    }

    _tryResolveUnifiedMaterial() {
        const cameras = this.app.root.findComponents('camera');
        if (!cameras.length) {
            return null;
        }
        const cameraComponent = cameras[0];
        let layer = null;
        if (Array.isArray(cameraComponent.layers) && cameraComponent.layers.length) {
            layer = this.app.scene.layers.getLayerById(cameraComponent.layers[0]);
        }
        if (!layer) {
            layer = this.app.scene.layers.getLayerByName('World');
        }
        if (!layer) {
            return null;
        }
        const getMaterial = this.app.systems.gsplat.getMaterial || this.app.systems.gsplat.getGSplatMaterial;
        return getMaterial ? getMaterial.call(this.app.systems.gsplat, cameraComponent.camera, layer) : null;
    }

    applyShaders() {
        if (this.entity.gsplat?.unified) {
            // Unified mode: Apply to template material
            this.applyToUnifiedMaterials();
        } else {
            // Non-unified mode: Apply to component's material
            this.applyToComponentMaterial();
        }
    }

    removeShaders() {
        if (!this.material) return;

        const device = this.app.graphicsDevice;
        const shaderLanguage = device?.isWebGPU ? 'wgsl' : 'glsl';
        console.log(shaderLanguage);

        this.material.getShaderChunks(shaderLanguage).delete('gsplatModifyVS');
        this.material.update();
        this.material = null;
    }

    applyToComponentMaterial() {
        const applyShader = () => {
            this.material = this.entity.gsplat?.material ?? null;
            if (!this.material) {
                if (!this._missingMaterialWarned) {
                    console.warn(`${this.constructor.name}: gsplat material not available yet.`);
                    this._missingMaterialWarned = true;
                }
                return;
            }
            this.applyShaderToMaterial(this.material);
        };

        if (this.entity.gsplat?.material) {
            applyShader();
        } else {
            this.shadersNeedApplication = true;
        }
    }

    applyToUnifiedMaterials() {
        const resolvedMaterial = this._tryResolveUnifiedMaterial();
        if (resolvedMaterial) {
            this._unifiedMaterial = resolvedMaterial;
            this.material = resolvedMaterial;
            this.applyShaderToMaterial(resolvedMaterial);
            return;
        }
        if (this._unifiedMaterial) {
            this.material = this._unifiedMaterial;
            this.applyShaderToMaterial(this.material);
            return;
        }
        if (!this._missingMaterialWarned) {
            console.warn(`${this.constructor.name}: gsplat template material not available yet.`);
            this._missingMaterialWarned = true;
        }
        if (!this._materialListenerAttached) {
            this.app.systems.gsplat.on('material:created', this._onMaterialCreated);
            this._materialListenerAttached = true;
        }
    }

    applyShaderToMaterial(material) {
        console.log("applyShaderToMaterial");
        const device = this.app.graphicsDevice;
        console.log(this.app.graphicsDevice);
        const shaderLanguage = device?.isWebGPU ? 'wgsl' : 'glsl';

        const customShader = shaderLanguage === 'wgsl' ? this.getShaderWGSL() : this.getShaderGLSL();

        material.getShaderChunks(shaderLanguage).set('gsplatModifyVS', customShader);
        material.update();
        //this.material = material;

        this.shadersNeedApplication = false;
    }

    update(dt) {
        // If not initialized, try to complete initialization
        if (!this.initialized) {
            if (this.entity.gsplat) {
                this.initialized = true;
            } else {
                return;
            }
        }

        // Apply shaders if they're needed (can happen if enabled after initialization)
        if (this.shadersNeedApplication) {
            this.applyShaders();
        }

        if (!this.material) {
            if (this.entity.gsplat?.unified) {
                const resolvedMaterial = this._tryResolveUnifiedMaterial();
                if (resolvedMaterial) {
                    this._unifiedMaterial = resolvedMaterial;
                    this.material = resolvedMaterial;
                    this.applyShaderToMaterial(resolvedMaterial);
                }
            }
            //console.warn("no material in update");
            return;
        }

        // Update time
        this.effectTime += dt;

        // Let subclass update the effect
        this.updateEffect(this.effectTime, dt);

        // Update material after all parameters have been set (if still valid)
        // Note: material may be set to null by removeShaders() if effect disables itself
        if (this.material) {
            this.material.update();
        }
    }

    destroy() {
        // Remove shaders if they're still applied
        this.removeShaders();
        if (this._materialListenerAttached) {
            this.app.systems.gsplat.off('material:created', this._onMaterialCreated);
            this._materialListenerAttached = false;
        }
    }

    /**
     * Get the GLSL shader string.
     * Must be implemented by subclasses.
     * @returns {string} GLSL shader code
     * @abstract
     */
    getShaderGLSL() {
        throw new Error(`${this.constructor.name} must implement getShaderGLSL()`);
    }

    /**
     * Get the WGSL shader string.
     * Must be implemented by subclasses.
     * @returns {string} WGSL shader code
     * @abstract
     */
    getShaderWGSL() {
        throw new Error(`${this.constructor.name} must implement getShaderWGSL()`);
    }

    /**
     * Set a uniform value on the material.
     * @param {string} name - The uniform name
     * @param {*} value - The uniform value
     */
    setUniform(name, value) {
        this.material?.setParameter(name, value);
    }

    /**
     * Update effect each frame.
     * Must be implemented by subclasses if they need to update uniforms or check completion.
     * @param {number} effectTime - Time since effect was enabled in seconds
     * @param {number} dt - Delta time in seconds
     * @abstract
     */
    updateEffect(effectTime, dt) {
        // Optional to override
    }
}

//export { GsplatShaderEffect };
