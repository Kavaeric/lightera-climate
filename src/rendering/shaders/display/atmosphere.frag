// Atmosphere fragment shader
// Basic flat shader for atmosphere visualisation

precision highp float;

in vec2 vUv;
in float vFacing;
in float vFresnel;

out vec4 fragColour;

void main() {
  vec3 atmosphereColourCentre = vec3(0.3, 0.5, 0.9);
  vec3 atmosphereColourEdge = vec3(0.9, 1.0, 1.0);
  float atmosphereOpacityCentre = 0.1;
  float atmosphereOpacityEdge = 0.5;
  
  float atmosphereMix = (atmosphereOpacityCentre * (vFresnel + atmosphereOpacityCentre)) +
                        (atmosphereOpacityEdge * smoothstep(0.8, 1.0, vFresnel) * atmosphereOpacityEdge);

  fragColour = vec4(mix(atmosphereColourCentre, atmosphereColourEdge, atmosphereMix), atmosphereMix );
}
