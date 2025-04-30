precision highp float;

uniform vec3 uLightIs;

void main() {
    gl_FragColor = vec4(uLightIs, 1.0);
}
