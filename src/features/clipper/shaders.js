/* Glass shaders for the clipper: a 16-tap chromatic refraction of a
   background texture, plus two specular lobes and a gold Fresnel rim.
   Rendered twice (back faces, then front faces) for depth. */

export const glassVertexShader = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vEye;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec4 mvPos = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPos;
    vNormal = normalize(normalMatrix * normal);
    vEye = normalize(mvPos.xyz);
  }
`;

export const glassFragmentShader = /* glsl */`
  uniform sampler2D uTexture; uniform vec2 uResolution;
  uniform float uBackside; uniform float uIorR; uniform float uIorY;
  uniform float uIorG; uniform float uIorC; uniform float uIorB;
  uniform float uIorP; uniform float uRefractPower; uniform float uChromatic;
  uniform float uSaturation; uniform float uShininess;
  uniform float uDiffuseness; uniform float uFresnelPower; uniform vec3 uLight;
  uniform vec2 uLensCenter; uniform float uLensRadius;
  varying vec3 vNormal; varying vec3 vEye;

  float specular(vec3 lightVec, vec3 n, vec3 eye, float shininess, float diffuseness) {
    vec3 view = -eye; vec3 halfVec = normalize(lightVec + view);
    return pow(max(dot(n, halfVec), 0.0), shininess) + max(0.0, dot(n, lightVec)) * diffuseness;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec3 n = normalize(vNormal); if (uBackside > 0.5) n = -n;
    vec3 eye = normalize(vEye); vec3 color = vec3(0.0);
    float edge = 1.0 - max(dot(n, -eye), 0.0);
    float lens = 0.5 + 1.7 * edge;
    vec2 lensDelta = uv - uLensCenter;
    float lensDistance = length(lensDelta) / max(uLensRadius, 0.001);
    float lensMask = 1.0 - smoothstep(0.76, 1.0, lensDistance);
    vec2 lensDirection = lensDelta / max(length(lensDelta), 0.001);
    vec2 lensUv = uLensCenter + lensDelta * (1.0 - lensMask * 0.46);
    vec2 chromaShift = lensDirection * lensMask * uChromatic * 0.006;
    const int LOOP = 16;
    for (int i = 0; i < LOOP; i++) {
      float slide = float(i) / float(LOOP) * 0.045;
      vec3 refrR = refract(eye, n, 1.0/uIorR); vec3 refrY = refract(eye, n, 1.0/uIorY);
      vec3 refrG = refract(eye, n, 1.0/uIorG); vec3 refrC = refract(eye, n, 1.0/uIorC);
      vec3 refrB = refract(eye, n, 1.0/uIorB); vec3 refrP = refract(eye, n, 1.0/uIorP);
      float r = texture2D(uTexture, lensUv - chromaShift + refrR.xy * (uRefractPower + slide * 1.0) * uChromatic * lens).x * 0.5;
      vec3 texY = texture2D(uTexture, lensUv + refrY.xy * (uRefractPower + slide * 1.0) * uChromatic * lens).xyz;
      float y = (texY.x * 2.0 + texY.y * 2.0 - texY.z) / 6.0;
      float g = texture2D(uTexture, lensUv + refrG.xy * (uRefractPower + slide * 2.0) * uChromatic * lens).y * 0.5;
      vec3 texC = texture2D(uTexture, lensUv + refrC.xy * (uRefractPower + slide * 2.5) * uChromatic * lens).xyz;
      float c = (texC.y * 2.0 + texC.z * 2.0 - texC.x) / 6.0;
      float b = texture2D(uTexture, lensUv + chromaShift + refrB.xy * (uRefractPower + slide * 3.0) * uChromatic * lens).z * 0.5;
      vec3 texP = texture2D(uTexture, lensUv + refrP.xy * (uRefractPower + slide * 1.0) * uChromatic * lens).xyz;
      float p = (texP.z * 2.0 + texP.x * 2.0 - texP.y) / 6.0;
      float R = r + (2.0*p + 2.0*y - c)/3.0; float G = g + (2.0*y + 2.0*c - p)/3.0; float B = b + (2.0*c + 2.0*p - y)/3.0;
      color += vec3(R, G, B);
    }
    color /= float(LOOP);
    float luma = dot(color, vec3(0.2125, 0.7154, 0.0721));
    color = mix(vec3(luma), color, uSaturation);
    color = mix(color, vec3(1.0, 0.58, 0.18), 0.28);
    float spec = specular(normalize(-uLight), n, eye, uShininess, uDiffuseness) +
                 0.6 * specular(normalize(-vec3(1.0, 1.0, -1.0)), n, eye, uShininess * 0.6, uDiffuseness * 0.5);
    color += spec * (uBackside > 0.5 ? 0.35 : 1.0);
    float f = pow(edge, uFresnelPower);
    float rim = clamp(f * (uBackside > 0.5 ? 0.62 : 0.96), 0.0, 0.92);
    color = mix(color, vec3(1.0, 0.82, 0.48), rim);
    float fringe = smoothstep(0.22, 0.88, edge) * 0.12;
    color += vec3(fringe * 0.32, fringe * 0.04, fringe * 0.48);
    color += vec3(0.012, 0.006, 0.001);
    float alpha = clamp(0.76 + rim * 0.22 + spec * (uBackside > 0.5 ? 0.12 : 0.22), 0.76, 0.98);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

export const bgVertexShader = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }
`;
export const bgFragmentShader = /* glsl */`
  uniform sampler2D uTex; varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(uTex, vUv);
    #include <colorspace_fragment>
  }
`;
