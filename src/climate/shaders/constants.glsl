// Constants, useful in multiple climate passes
precision highp float;

// Pi
// The ratio of a circle's circumference to its diameter
// I actually memorised more digits than this
const float PI = 3.14159265358979323846264338327950288419716939937510582097494459;

// Stefan-Boltzmann constant, intensity of blackbody radiation
const float STEFAN_BOLTZMANN_CONST = 5.670374419e-8; // W/(m²·K⁴)

// Cosmic background temperature
const float COSMIC_BACKGROUND_TEMP = 2.7; // K

// Speed of light in a vacuum
const float SPEED_OF_LIGHT = 299792458.0;   // m/s

// Planck constant
const float PLANCK_CONST = 6.62607015e-34;  // J·s

// Boltzmann constant, energy of a gas as a function of its temperature
const float BOLTZMANN_CONST = 1.380649e-23; // J/K

// Unit conversions
const float SQUARE_METRES_TO_SQUARE_CM = 1e4; // 1 m² = 10⁴ cm²

// Simulation constants
// The depth of the surface layer of the planet being simulated
const float SIMULATION_SURFACE_DEPTH = 50.0; // m
// The quantisation of the surface layer of the planet being simulated
const float SIMULATION_DEPTH_QUANTUM = 0.1; // m

// Physical properties of rock/dry ground
const float MATERIAL_ROCK_DENSITY = 2700.0; // kg/m³
const float MATERIAL_ROCK_SPECIFIC_HEAT = 790.0; // J/(kg·K)
const float MATERIAL_ROCK_HEAT_CAPACITY_PER_AREA = MATERIAL_ROCK_DENSITY * MATERIAL_ROCK_SPECIFIC_HEAT * SIMULATION_SURFACE_DEPTH; // J/(m²·K)
const float MATERIAL_ROCK_THERMAL_CONDUCTIVITY = 2.5; // W/(m·K) - typical for rock/soil
const float MATERIAL_ROCK_ALBEDO_VISIBLE = 0.15;
const float MATERIAL_ROCK_ALBEDO_INFRARED = 0.15;
const float MATERIAL_ROCK_EMISSIVITY = 0.96;

// Physical properties of water (liquid)
const float MATERIAL_WATER_DENSITY = 1000.0; // kg/m³
const float MATERIAL_WATER_SPECIFIC_HEAT = 4181.0; // J/(kg·K)
const float MATERIAL_WATER_HEAT_CAPACITY_PER_AREA = MATERIAL_WATER_DENSITY * MATERIAL_WATER_SPECIFIC_HEAT * SIMULATION_SURFACE_DEPTH; // J/(m²·K)
const float MATERIAL_WATER_THERMAL_CONDUCTIVITY = 0.6; // W/(m·K) - thermal conductivity of water
const float MATERIAL_WATER_ALBEDO_VISIBLE = 0.06;
const float MATERIAL_WATER_ALBEDO_INFRARED = 0.06;
const float MATERIAL_WATER_EMISSIVITY = 0.96;
const float MATERIAL_WATER_LATENT_HEAT_VAPORISATION = 2260000.0; // J/kg (energy to vaporise 1kg water at 100°C)
// Note: In reality, the latent heat of vaporisation varies with temperature, decreasing as temperature increases.
// This value is for 100°C at standard Earth pressure. At higher temperatures, it's lower.

// Physical properties of ice
// Note: We use 1:1 volume ratio for phase transitions between ice and water because things get complex fast.
// const float MATERIAL_ICE_DENSITY = 917.0; // kg/m³
const float MATERIAL_ICE_DENSITY = 1000.0; // kg/m³
const float MATERIAL_ICE_SPECIFIC_HEAT = 2050.0; // J/(kg·K)
const float MATERIAL_ICE_HEAT_CAPACITY_PER_AREA = MATERIAL_ICE_DENSITY * MATERIAL_ICE_SPECIFIC_HEAT * SIMULATION_SURFACE_DEPTH; // J/(m²·K)
const float MATERIAL_ICE_THERMAL_CONDUCTIVITY = 2.2; // W/(m·K) - thermal conductivity of ice
const float MATERIAL_ICE_ALBEDO_VISIBLE = 0.60;
const float MATERIAL_ICE_ALBEDO_INFRARED = 0.10;
const float MATERIAL_ICE_EMISSIVITY = 0.985;
const float MATERIAL_ICE_LATENT_HEAT_FUSION = 334000.0; // J/kg (energy to melt 1kg ice at 0°C)
