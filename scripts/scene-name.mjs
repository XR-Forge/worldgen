import { Script, Color } from 'playcanvas';

/**
 * Cube
 *
 * Rotates the cube at a specified speed and allows its color to be changed
 * via app-wide events: 'setrotation' and 'setcolor'.
 */
export class SceneName extends Script {
    initialize() {
        // this.rotateSpeed = 0;

        // this.app.on('setrotation', (speed) => {
        //     this.rotateSpeed = speed;
        // });

        this.app.on('setcolor', (color) => {
            const renders = this.entity.findComponents('render');
            for (let i = 0; i < renders.length; ++i) {
                const meshInstances = renders[i].meshInstances;
                for (let j = 0; j < meshInstances.length; j++) {
                    meshInstances[j].material.diffuse.copy(color);
                    meshInstances[j].material.update();
                }
            }
        });
    }

    update(dt) {
        // this.entity.rotate(0, this.rotateSpeed * dt, 0);
    }
}