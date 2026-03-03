
// Shader Inputs
// uniform vec3      iResolution;           // viewport resolution (in pixels)
// uniform float     iTime;                 // shader playback time (in seconds)
// uniform float     iTimeDelta;            // render time (in seconds)
// uniform float     iFrameRate;            // shader frame rate
// uniform int       iFrame;                // shader playback frame
// uniform float     iChannelTime[4];       // channel playback time (in seconds)
// uniform vec3      iChannelResolution[4]; // channel resolution (in pixels)
// uniform vec4      iMouse;                // mouse pixel coords. xy: current (if MLB down), zw: click
// uniform samplerXX iChannel0..3;          // input channel. XX = 2D/Cube
// uniform vec4      iDate;                 // (year, month, day, time in seconds)

#define W0 0x3504f335u
#define W1 0x8fc1ecd5u
#define M 741103597u

uint fast_hash(uint x, uint y) {
    x *= W0;
    y *= W1;
    x ^= y;
    x *= M;
    return x;
}

float hash_to_float(uint h) {
    return float(h >> 8u) * (1.0 / 16777216.0);
}

vec2 rand_vec(uvec2 p) {
    float angle = hash_to_float(fast_hash(p.x, p.y)) * radians(360.);
    return vec2(cos(angle), sin(angle));
}

float perlin_noise(in vec2 point, vec2 wrap, float seed) {
    vec2 point_i = floor(point);
    vec2 point_f = fract(point);

	vec2 vec_tl = rand_vec(uvec2(mod(point_i + vec2(0., 0.), wrap) + vec2(seed)));
	vec2 vec_tr = rand_vec(uvec2(mod(point_i + vec2(1., 0.), wrap) + vec2(seed)));
	vec2 vec_bl = rand_vec(uvec2(mod(point_i + vec2(0., 1.), wrap) + vec2(seed)));
	vec2 vec_br = rand_vec(uvec2(mod(point_i + vec2(1., 1.), wrap) + vec2(seed)));

	vec2 u = point_f * point_f * (3.0 - 2.0 * point_f);
    return mix(
        mix(dot(vec_tl, point_f - vec2(0.0, 0.0)), dot(vec_tr, point_f - vec2(1.0, 0.0)), u.x),
        mix(dot(vec_bl, point_f - vec2(0.0, 1.0)), dot(vec_br, point_f - vec2(1.0, 1.0)), u.x),
        u.y
    ) * 1.41;
}


float cloud_noise(vec2 uv, float freq, float seed, float time) {
    vec2 wrap = vec2(24., 24.);
    vec2 move = vec2(-time, -time) * wrap;
    float v1 = abs(perlin_noise(uv * freq + move * vec2(-1.0, 1.0), wrap, seed));
    float v2 = abs(perlin_noise(uv * freq * 2. + move * 1.5, wrap * 1.5, seed + wrap.x)) * 0.5;
    float v3 = abs(perlin_noise(uv * freq * 4. + move * 2., wrap * 2., seed + wrap.x * 2.5)) * 0.25;

    float x_mul = min(smoothstep(0.0, 0.5, uv.x), smoothstep(1.0, 0.5, uv.x));
    float y_mul = min(smoothstep(0.0, 0.2, uv.y), smoothstep(1.0, 0.2, uv.y));

    return (v1 + v2 + v3) * x_mul * y_mul * 1. - 0.1;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{

    fragCoord = floor(fragCoord / 2.0) * 2.0;
    
    vec3 light_dir = vec3(cos(iTime * 0.1), sin(iTime * 0.1), 0.0);
    if (iMouse.z > 0.0) {
        vec2 center = iResolution.xy / 2.;
        light_dir = vec3(normalize(iMouse.xy - center), 0.);
    }
    
    float morph_time = 3600.0;
    float freq = 1.5;
    float height = cloud_noise(fragCoord / iResolution.xy, freq, 0., mod(iTime / morph_time, 1.0));
    float other = cloud_noise((fragCoord - light_dir.xy) / iResolution.xy, freq, 0., mod(iTime / morph_time, 1.0));
    float brightness = mix(0.8, 1.0, ceil(other - height));
    
    vec3 sky = vec3(0.1, 0.5, 0.9);
    
    height = min(ceil(max(height, 0.0)), 1.0);
    fragColor = vec4(mix(sky, mix(sky, vec3(1.0), brightness), height), 1.0);
}