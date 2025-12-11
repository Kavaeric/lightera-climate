// Convert HSL to RGB
// Input: vec3(hue, saturation, lightness)
// Hue: 0.0 to 1.0 (maps to 0-360 degrees)
// Saturation: 0.0 to 1.0
// Lightness: 0.0 to 1.0
// Output: vec3(red, green, blue) in range 0.0 to 1.0
vec3 hsl2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
}

