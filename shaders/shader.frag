precision highp float;

const int MAX_LIGHTS = 7;

struct LightInfo {
    vec3 pos;
    vec3 Ia;
    vec3 Id;
    vec3 Is;
    bool isDirectional;
    bool isActive;
};

struct MaterialInfo {
    vec3 Ka;
    vec3 Kd;        
    vec3 Ks;
    float shininess;
};


varying vec3 fNormal; 
varying vec3 posC;         //P em coordenadas da camera

uniform int uNLights; // Effective number of lights used

uniform LightInfo uLight[MAX_LIGHTS]; // The array of lights present in the scene
uniform MaterialInfo uMaterial;  // The material of the object being drawn

uniform mat4 mView;        // Matriz resultante de lookAt()
uniform mat4 mViewNormals; // Matriz inversa da transposta de mView

void main() {
    for(int i = 0; i < MAX_LIGHTS; i++) {
        if(i == uNLights) 
            break;
    
        if(uLight[i].isActive){
            vec3 aColor = uLight[i].Ia*uMaterial.Ka;
            vec3 dColor = uLight[i].Id*uMaterial.Kd;
            vec3 sColor = uLight[i].Is*uMaterial.Ks;

            vec3 N = normalize(fNormal); //Vetor normal 

            vec3 L;                                 
            if(uLight[i].isDirectional)                                     // Direcional  
                L = normalize((mViewNormals*vec4(uLight[i].pos, 0.0)).xyz);
            else 
                L = normalize((mView*vec4(uLight[i].pos, 1.0)).xyz - posC);
                
            vec3 V = normalize(-posC);
            vec3 R = reflect(-L, N);                                        

            float diffuseFactor = max (dot(N, L), 0.0);
            vec3 diffuse = diffuseFactor * dColor;

            float specularFactor = pow(max(dot(R,V), 0.0), uMaterial.shininess);
            vec3 specular = specularFactor * sColor;

            if(dot(L,N)< 0.0)        
                specular = vec3(0.0, 0.0, 0.0);
                
            gl_FragColor.xyz = gl_FragColor.xyz + vec3(aColor+diffuse+specular);
        }
    }

}   
