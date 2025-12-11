// Convert RGB to HSL
// Input: vec3(red, green, blue) in range 0.0 to 1.0
// Output: vec3(hue, saturation, lightness)
// Hue: 0.0 to 1.0 (maps to 0-360 degrees)
// Saturation: 0.0 to 1.0
// Lightness: 0.0 to 1.0
vec3 rgb2hsl(vec3 c) {
  float maxVal = max(max(c.r, c.g), c.b);
  float minVal = min(min(c.r, c.g), c.b);
  float delta = maxVal - minVal;
  float deltaSafe = delta + 1e-10; // Avoid division by zero
  
  // Determine which component is maximum
  float isR = step(c.g, c.r) * step(c.b, c.r);
  float isG = step(c.r, c.g) * step(c.b, c.g) * (1.0 - isR);
  float isB = 1.0 - isR - isG;
  
  // Calculate hue for each case
  float hR = mod(((c.g - c.b) / deltaSafe) + step(c.b, c.g) * 6.0, 6.0);
  float hG = ((c.b - c.r) / deltaSafe) + 2.0;
  float hB = ((c.r - c.g) / deltaSafe) + 4.0;
  
  // Select hue based on which component is max
  float h = hR * isR + hG * isG + hB * isB;
  h = mix(0.0, h / 6.0, step(1e-10, delta));
  
  // Lightness is the average of max and min
  float l = (maxVal + minVal) / 2.0;
  
  // Saturation: avoid division by zero
  float denom = 1.0 - abs(2.0 * l - 1.0);
  float s = mix(0.0, delta / (denom + 1e-10), step(1e-10, denom) * step(1e-10, delta));
  
  return vec3(h, s, l);
}
