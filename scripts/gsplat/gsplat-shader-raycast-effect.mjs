import { Vec3, Color, Mat4 } from 'playcanvas';
import { GsplatShaderEffect } from './gsplat-shader-effect.mjs';

const shaderGLSL = /* glsl */`
uniform vec3 uHighlightCenter;
uniform float uHighlightRadius;
uniform float uHighlightSoftness;
uniform vec3 uHighlightColor;
uniform float uHighlightBlend;

void modifySplatColor(vec3 center, inout vec4 color) {
    float dist = length(center - uHighlightCenter);
    float edge = max(uHighlightSoftness, 0.0001);
    float mask = 1.0 - smoothstep(uHighlightRadius, uHighlightRadius + edge, dist);
    float blend = clamp(uHighlightBlend, 0.0, 1.0) * mask;
    color.rgb = mix(color.rgb, uHighlightColor, blend);
}
`;

const shaderWGSL = /* wgsl */`
uniform uHighlightCenter: vec3f;
uniform uHighlightRadius: f32;
uniform uHighlightSoftness: f32;
uniform uHighlightColor: vec3f;
uniform uHighlightBlend: f32;

fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    let dist = length(center - uniform.uHighlightCenter);
    let edge = max(uniform.uHighlightSoftness, 0.0001);
    let mask = 1.0 - smoothstep(uniform.uHighlightRadius, uniform.uHighlightRadius + edge, dist);
    let blend = clamp(uniform.uHighlightBlend, 0.0, 1.0) * mask;
    (*color).rgb = mix((*color).rgb, uniform.uHighlightColor, blend);
}
`;

/**
 * Shader effect that highlights a gsplat area by blending with a color.
 *
 * @example
 * entity.addComponent('script');
 * entity.script.create(GsplatShaderRaycastEffect, {
 *     attributes: {
 *         center: new Vec3(0, 0, 0),
 *         radius: 1.5,
 *         softness: 0.5,
 *         highlightColor: new Color(1, 0.2, 0.1),
 *         blend: 0.8
 *     }
 * });
 */
export class GsplatShaderRaycastEffect extends GsplatShaderEffect {
    static scriptName = 'gsplatShaderRaycastEffect';

    /**
     * Highlight center in world space.
     * @attribute
     */
    center = new Vec3(0, 0, 0);

    /**
     * Highlight radius.
     * @attribute
     * @range [0, 50]
     */
    radius = 1;

    /**
     * Soft edge size beyond radius.
     * @attribute
     * @range [0, 20]
     */
    softness = 0.5;

    /**
     * Highlight color to blend towards.
     * @attribute
     */
    highlightColor = new Color(1, 0.2, 0.1);

    /**
     * Blend strength (0 = no effect, 1 = full highlight).
     * @attribute
     * @range [0, 1]
     */
    blend = 0.8;

    _centerArray = [0, 0, 0];
    _colorArray = [0, 0, 0];
    _worldToLocal = new Mat4();
    _localCenter = new Vec3();

    getShaderGLSL() {
        return shaderGLSL;
    }

    getShaderWGSL() {
        return shaderWGSL;
    }

    updateEffect() {
        this._worldToLocal.copy(this.entity.getWorldTransform()).invert();
        this._worldToLocal.transformPoint(this.center, this._localCenter);

        this._centerArray[0] = this._localCenter.x;
        this._centerArray[1] = this._localCenter.y;
        this._centerArray[2] = this._localCenter.z;
        this.setUniform('uHighlightCenter', this._centerArray);

        this._colorArray[0] = this.highlightColor.r;
        this._colorArray[1] = this.highlightColor.g;
        this._colorArray[2] = this.highlightColor.b;
        this.setUniform('uHighlightColor', this._colorArray);

        this.setUniform('uHighlightRadius', this.radius);
        this.setUniform('uHighlightSoftness', this.softness);
        this.setUniform('uHighlightBlend', this.blend);
    }
}
