// Source: Playcanvas Engine v1.93.0, follow-world-target.mjs

import { Vec3 } from 'playcanvas';
import { Script } from 'playcanvas';

/**
 * Makes an element follow a world-space target using screen space coordinates.
 * Requires the element to be anchored to the bottom-left corner.
 */
export class FollowWorldTarget extends Script {
    /**
     * The entity to follow in world space.
     * 
     * @attribute
     * @title Target
     * @type {pc.Entity}
     */
    target;

    /**
     * The camera entity used to convert world position to screen space.
     * 
     * @attribute
     * @title Camera
     * @type {pc.Entity}
     */
    camera;

    initialize() {
        // IMPORTANT: The element must be anchored to the bottom left of the screen
    }

    postUpdate(dt) {
        // World space position of target
        const worldPos = this.target.getPosition();
        const screenPos = new Vec3();

        // Convert to screen space
        this.camera.camera.worldToScreen(worldPos, screenPos);

        // Check if the entity is in front of the camera
        if (screenPos.z > 0) {
            this.entity.element.enabled = true;

            // Take pixel ratio into account
            const pixelRatio = this.app.graphicsDevice.maxPixelRatio;
            screenPos.x *= pixelRatio;
            screenPos.y *= pixelRatio;

            const device = this.app.graphicsDevice;

            // Elements are positioned between -1 and 1 on both axes
            this.entity.setPosition(
                ((screenPos.x / device.width) * 2) - 1,
                ((1 - (screenPos.y / device.height)) * 2) - 1,
                0
            );
        } else {
            this.entity.element.enabled = false;
        }
    }

    // swap(old) {
    //     // Handle hot-reloading if needed
    // }
}