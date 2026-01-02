// Cell highlight fragment shader
// Renders highlight with Fresnel effect on front faces, lower alpha on back faces

precision highp float;

uniform float frontAlpha;
uniform float backAlpha;

in vec3 vWorldPosition;
in float vIsFacingCamera;

out vec4 fragColour;

void main() {
  // Calculate Fresnel effect
  vec3 normal = normalize(vWorldPosition);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float fresnel = 1.0 - dot(normal, viewDir);

  // Use Fresnel on front faces, lower alpha on back faces
  float alpha = max(fresnel * vIsFacingCamera, frontAlpha) +
                backAlpha * (1.0 - vIsFacingCamera);

  fragColour = vec4(1.0, 1.0, 1.0, alpha);
}
