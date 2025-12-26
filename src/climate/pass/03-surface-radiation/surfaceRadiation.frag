precision highp float;

#include "../../../shaders/textureAccessors.glsl"
#include "../../constants.glsl"

varying vec2 vUv;

void main() {
	// Read cell position
	vec2 cellLatLon = getCellLatLon(vUv);

	// Read cell area
	float cellArea = getCellArea(vUv);

	// Read surface temperature
	float surfaceTemperature = getSurfaceTemperature(vUv);
}