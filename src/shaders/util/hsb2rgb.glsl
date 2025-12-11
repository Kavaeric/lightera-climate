// Convert HSB (HSV) to RGB
// Input: vec3(hue, saturation, brightness/value)
// Hue: 0.0 to 1.0 (maps to 0-360 degrees)
// Saturation: 0.0 to 1.0
// Brightness/Value: 0.0 to 1.0
// Output: vec3(red, green, blue) in range 0.0 to 1.0
vec3 hsb2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

