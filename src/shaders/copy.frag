// Simple copy shader for initializing render targets
precision highp float;

uniform sampler2D sourceTex;
varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(sourceTex, vUv);
}
