import { useEffect, useRef } from "react"

/**
 * three.js is ~600KB. We lazy-load it so it only downloads when the
 * Auth page or PasswordGate actually mounts — never on the editor path.
 */
export function ShaderAnimation() {
  const containerRef = useRef<HTMLDivElement>(null)
  // Store cleanup fn from the async setup so the effect cleanup can call it.
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    let cancelled = false

    import("three").then((THREE) => {
      if (cancelled || !container) return

      const vertexShader = `void main() { gl_Position = vec4(position, 1.0); }`
      const fragmentShader = `
        #define TWO_PI 6.2831853072
        #define PI 3.14159265359
        precision highp float;
        uniform vec2 resolution;
        uniform float time;
        void main(void) {
          vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
          float t = time * 0.05;
          float lineWidth = 0.002;
          vec3 color = vec3(0.0);
          for(int j = 0; j < 3; j++){
            for(int i = 0; i < 5; i++){
              color[j] += lineWidth * float(i * i) / abs(fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2));
            }
          }
          gl_FragColor = vec4(color[0], color[1], color[2], 1.0);
        }
      `

      const camera = new THREE.Camera()
      camera.position.z = 1
      const scene = new THREE.Scene()
      const geometry = new THREE.PlaneGeometry(2, 2)
      const uniforms = {
        time: { value: 1.0 },
        resolution: { value: new THREE.Vector2() },
      }
      const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
      scene.add(new THREE.Mesh(geometry, material))

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(window.devicePixelRatio)
      container.appendChild(renderer.domElement)

      const onResize = () => {
        renderer.setSize(container.clientWidth, container.clientHeight)
        uniforms.resolution.value.set(renderer.domElement.width, renderer.domElement.height)
      }
      onResize()
      window.addEventListener("resize", onResize, false)

      let animId = 0
      const animate = () => {
        animId = requestAnimationFrame(animate)
        uniforms.time.value += 0.1
        renderer.render(scene, camera)
      }
      animate()

      cleanupRef.current = () => {
        window.removeEventListener("resize", onResize)
        cancelAnimationFrame(animId)
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
        renderer.dispose()
        geometry.dispose()
        material.dispose()
      }
    })

    return () => {
      cancelled = true
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-screen"
      style={{ background: "#000", overflow: "hidden" }}
    />
  )
}
