import { Color, Mesh, MeshStandardMaterial, PlaneGeometry, type WebGLProgramParametersWithUniforms } from 'three'
import { SEA_COLOR, SEA_LEVEL } from './sceneConfig.ts'

const SIZE = 700
const SEGMENTS = 110
/** Tall enough to read as swell, small enough that the deck never looks adrift. */
const SWELL = 0.35

/**
 * The waves, laid over the flat plane in the vertex shader: a few sines on
 * top of each other, so no two crests line up. The height and the surface
 * slope come from the same formula, so the light glints off the crests as they
 * move — and the CPU does no per-frame work for any of it.
 */
const WAVE_HEIGHT = `
  float waveHeight(vec2 p, float t) {
    return (sin(p.x * 0.07 + t * 0.9) * 0.55
          + sin(p.y * 0.09 - t * 0.7) * 0.4
          + sin((p.x + p.y) * 0.16 + t * 1.4) * 0.25) * ${SWELL.toFixed(3)};
  }
  vec2 waveSlope(vec2 p, float t) {
    float diagonal = cos((p.x + p.y) * 0.16 + t * 1.4) * 0.16 * 0.25;
    return vec2(
      cos(p.x * 0.07 + t * 0.9) * 0.07 * 0.55 + diagonal,
      cos(p.y * 0.09 - t * 0.7) * 0.09 * 0.4 + diagonal
    ) * ${SWELL.toFixed(3)};
  }
`

/** The sea under the treadmill: a wide, gently heaving plane. */
export class Ocean {
  readonly mesh: Mesh
  private readonly geometry = new PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS)
  private readonly material = new MeshStandardMaterial({
    color: new Color(SEA_COLOR),
    roughness: 0.22,
    metalness: 0.05,
  })
  private timeUniform = { value: 0 }

  constructor() {
    this.geometry.rotateX(-Math.PI / 2)
    this.material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uTime = this.timeUniform
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', `uniform float uTime;\n${WAVE_HEIGHT}\nvoid main() {`)
        // Tilt the surface to the slope of the wave under it...
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
           vec2 slope = waveSlope(position.xz, uTime);
           objectNormal = normalize(vec3(-slope.x, 1.0, -slope.y));`,
        )
        // ...and lift it to the height of that wave.
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           transformed.y += waveHeight(position.xz, uTime);`,
        )
    }
    this.mesh = new Mesh(this.geometry, this.material)
    this.mesh.position.y = SEA_LEVEL
    // Nothing on the sea needs a shadow, and looking one up for every pixel of it is not free.
    this.mesh.receiveShadow = false
  }

  update(seconds: number): void {
    this.timeUniform.value = seconds
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
