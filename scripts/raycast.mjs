import { Script, Vec3 } from 'playcanvas';

/**
 * Raycast helper script for PlayCanvas entities.
 * Performs a raycast from the entity's world position along its forward vector.
 *
 * @example
 * entity.addComponent('script');
 * const raycast = entity.script.create(Raycast);
 * raycast.raycast((hits) => {
 *     hits.forEach((hit) => console.log(hit.entity.name, hit.point));
 * });
 */
export class Raycast extends Script {
    static scriptName = 'raycast';

    /**
     * Maximum ray distance.
     * @attribute
     * @range [0.1, 1000]
     */
    distance = 10;

    /**
     * Collision mask for filtering physics layers.
     * @attribute
     * @range [0, 0xFFFFFFFF]
     */
    mask = 0xFFFFFFFF;

    /**
     * Whether to return only the first hit.
     * @attribute
     */
    firstHitOnly = false;

    _origin = new Vec3();
    _direction = new Vec3();
    _end = new Vec3();

    initialize() {
        this._missingPhysicsWarned = false;
    }

    /**
     * Perform a raycast from the entity and provide hits to the callback.
     * @param {(hits: import('playcanvas').RaycastResult[]) => void} onHits
     * @param {{
     *   distance?: number,
     *   origin?: import('playcanvas').Vec3,
     *   direction?: import('playcanvas').Vec3,
     *   mask?: number,
     *   firstHitOnly?: boolean,
     *   ignoreEntity?: import('playcanvas').Entity
     * }} [options]
     */
    raycast(onHits, options = {}) {
        if (typeof onHits !== 'function') {
            return;
        }

        const physics = this.app.systems.rigidbody;
        const ammoAvailable = typeof Ammo !== 'undefined';
        if (!physics || !ammoAvailable || !physics.dynamicsWorld) {
            if (!this._missingPhysicsWarned) {
                console.warn('Raycast: physics not available. Ensure Ammo.js is loaded and physics is enabled.');
                this._missingPhysicsWarned = true;
            }
            onHits([]);
            return;
        }

        const distance = typeof options.distance === 'number' ? options.distance : this.distance;
        const mask = typeof options.mask === 'number' ? options.mask : this.mask;
        const firstHitOnly = typeof options.firstHitOnly === 'boolean' ? options.firstHitOnly : this.firstHitOnly;

        if (options.origin) {
            this._origin.copy(options.origin);
        } else {
            this._origin.copy(this.entity.getPosition());
        }
        if (options.direction) {
            this._direction.copy(options.direction).normalize();
        } else {
            this._direction.copy(this.entity.forward).normalize();
        }
        this._end.copy(this._direction).mulScalar(distance).add(this._origin);

        const ignoreEntity = options.ignoreEntity || this.entity;
        const filterCallback = (entity) => entity !== ignoreEntity;
        const rayOptions = {
            filterCollisionMask: mask,
            filterCallback,
            sort: true
        };

        if (firstHitOnly) {
            const hit = physics.raycastFirst(this._origin, this._end, rayOptions);
            onHits(hit ? [hit] : []);
            return;
        }

        const hits = physics.raycastAll(this._origin, this._end, rayOptions) || [];
        onHits(hits);
    }
}
