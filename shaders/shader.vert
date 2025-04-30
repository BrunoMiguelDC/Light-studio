attribute vec4 vPosition;    // vertex position in modelling coordinates
attribute vec3 vNormal;      // vertex normal in modelling coordinates

uniform mat4 mModelView;
uniform mat4 mNormals;
uniform mat4 mProjection;

varying vec3 fNormal;        // normal vector in camera space
varying vec3 posC;

void main(){
    posC = (mModelView * vPosition).xyz;
    fNormal = (mNormals * vec4(vNormal, 0.0)).xyz;

    gl_Position = mProjection * mModelView * vPosition;
}